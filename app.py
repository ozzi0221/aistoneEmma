# app.py
from dotenv import load_dotenv
load_dotenv()
from flask import Flask, render_template, request, jsonify, Response
from flask_cors import CORS
from google import genai
from google.genai import types
import os
import json
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import re

from config import GEMINI_API_KEY, CHUNK_SIZE, CHUNK_OVERLAP, TOP_K_RETRIEVAL

app = Flask(__name__)
CORS(app)

# Gemini 클라이언트 초기화
client = genai.Client(api_key=GEMINI_API_KEY)

# --- 1. 지식 베이스 로딩 및 처리 (RAG의 핵심) ---

knowledge_base_chunks = []
chunk_embeddings = []
agent_data = {}

def load_agents_data(filename="agents.json"):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return {agent['id']: agent for agent in data.get('agents', [])}
    except FileNotFoundError:
        print(f"Error: {filename} 파일을 찾을 수 없습니다.")
        return {}
    except json.JSONDecodeError:
        print(f"Error: {filename} 파일이 올바른 JSON 형식이 아닙니다.")
        return {}

def load_and_chunk_document(filepath):
    chunks = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
            words = text.split()
            current_chunk = []
            current_len = 0
            for word in words:
                if current_len + len(word) + 1 <= CHUNK_SIZE:
                    current_chunk.append(word)
                    current_len += len(word) + 1
                else:
                    chunks.append(" ".join(current_chunk))
                    overlap_start = max(0, len(current_chunk) - CHUNK_OVERLAP // (len(word) + 1) if (len(word) + 1) > 0 else 0)
                    current_chunk = current_chunk[overlap_start:] + [word]
                    current_len = sum(len(w) for w in current_chunk) + len(current_chunk) - 1
            if current_chunk:
                chunks.append(" ".join(current_chunk))
    except FileNotFoundError:
        print(f"Error: 지식 베이스 파일 '{filepath}'을 찾을 수 없습니다.")
    return chunks

def get_embedding(text):
    try:
        response = client.models.embed_content(
            model="text-embedding-004",
            contents=text
        )
        return response.embeddings[0].values
    except Exception as e:
        print(f"임베딩 생성 중 오류 발생: {e}")
        return []

def initialize_knowledge_base():
    global knowledge_base_chunks, chunk_embeddings, agent_data

    agent_data = load_agents_data("agents.json")
    if not agent_data:
        print("에이전트 데이터를 로드할 수 없습니다. 초기화를 중단합니다.")
        return

    default_agent_id = list(agent_data.keys())[0]
    current_agent = agent_data.get(default_agent_id)

    if not current_agent or 'knowledge_base_path' not in current_agent:
        print("선택된 에이전트에 지식 베이스 경로가 정의되어 있지 않습니다.")
        return

    knowledge_base_filepath = current_agent['knowledge_base_path']
    print(f"지식 베이스 로딩 및 임베딩 생성 중: {knowledge_base_filepath}")

    knowledge_base_chunks = load_and_chunk_document(knowledge_base_filepath)
    if not knowledge_base_chunks:
        print("지식 베이스 청크를 생성하지 못했습니다.")
        return

    chunk_embeddings = [get_embedding(chunk) for chunk in knowledge_base_chunks]

    valid_indices = [i for i, embed in enumerate(chunk_embeddings) if embed]
    knowledge_base_chunks = [knowledge_base_chunks[i] for i in valid_indices]
    chunk_embeddings = [chunk_embeddings[i] for i in valid_indices]

    if not chunk_embeddings:
        print("유효한 청크 임베딩을 생성하지 못했습니다.")
        return

    print(f"지식 베이스 초기화 완료. {len(knowledge_base_chunks)}개의 청크 로드됨.")

with app.app_context():
    initialize_knowledge_base()

# --- 2. 라우팅 및 API 엔드포인트 ---

@app.route('/')
def index():
    default_agent_id = list(agent_data.keys())[0]
    return render_template('index.html', agent_info=agent_data.get(default_agent_id, {}))

@app.route('/get_agent_info', methods=['GET'])
def get_agent_info():
    default_agent_id = list(agent_data.keys())[0]
    return jsonify(agent_data.get(default_agent_id, {}))

@app.route('/ask_avatar', methods=['POST'])
def ask_avatar():
    user_question = request.json.get('question', '').strip()
    if not user_question:
        return jsonify({"response": "질문을 입력해주세요."}), 400

    if not knowledge_base_chunks or not chunk_embeddings:
        return jsonify({"response": "지식 베이스가 초기화되지 않았습니다. 잠시 후 다시 시도해주세요."}), 500

    try:
        question_embedding = get_embedding(user_question)
        if not question_embedding:
            raise Exception("질문 임베딩 생성 실패")

        similarities = []
        for i, embed in enumerate(chunk_embeddings):
            if embed:
                sim = cosine_similarity(np.array(question_embedding).reshape(1, -1), np.array(embed).reshape(1, -1))[0][0]
                similarities.append((sim, i))

        similarities.sort(key=lambda x: x[0], reverse=True)
        top_k_indices = [idx for sim, idx in similarities[:TOP_K_RETRIEVAL]]
        retrieved_chunks = [knowledge_base_chunks[i] for i in top_k_indices]

        context = "\n".join(retrieved_chunks)

        default_agent_id = list(agent_data.keys())[0]
        current_agent = agent_data.get(default_agent_id)
        personality = current_agent.get('personality', '친절하고 전문적인 AI 비서')

        sys_instruction = f"""
        당신은 AI Stone의 {personality} 아바타입니다.
        제공된 [정보]를 바탕으로 사용자의 질문에 답변하세요.
        만약 제공된 정보만으로는 답변할 수 없다면, '정보가 부족하여 답변하기 어렵습니다.'라고 말하세요.
        답변은 친절하고 간결하게 해주세요.
        """

        prompt = f"""
        [제공된 정보]:
        {context}

        [사용자 질문]:
        {user_question}
        """

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=sys_instruction)
        )

        generated_text = response.text.strip()
        generated_text = re.sub(r'```python|```json|```text|```', '', generated_text)
        generated_text = re.sub(r'\*\*(.*?)\*\*', r'\1', generated_text)

        return jsonify({"response": generated_text})

    except Exception as e:
        print(f"Error during RAG process: {e}")
        return jsonify({"response": "죄송합니다. 질문에 답변하는 데 문제가 발생했습니다."}), 500

@app.route('/ask_avatar_stream', methods=['POST'])
def ask_avatar_stream():
    user_question = request.json.get('question', '').strip()
    if not user_question:
        return jsonify({"error": "질문을 입력해주세요."}), 400

    if not knowledge_base_chunks or not chunk_embeddings:
        return jsonify({"error": "지식 베이스가 초기화되지 않았습니다. 잠시 후 다시 시도해주세요."}), 500

    def generate_stream():
        try:
            question_embedding = get_embedding(user_question)
            if not question_embedding:
                yield f"data: {json.dumps({'error': '질문 임베딩 생성 실패'})}\n\n"
                return

            similarities = []
            for i, embed in enumerate(chunk_embeddings):
                if embed:
                    sim = cosine_similarity(np.array(question_embedding).reshape(1, -1), np.array(embed).reshape(1, -1))[0][0]
                    similarities.append((sim, i))

            similarities.sort(key=lambda x: x[0], reverse=True)
            top_k_indices = [idx for sim, idx in similarities[:TOP_K_RETRIEVAL]]
            retrieved_chunks = [knowledge_base_chunks[i] for i in top_k_indices]

            context = "\n".join(retrieved_chunks)
            default_agent_id = list(agent_data.keys())[0]
            current_agent = agent_data.get(default_agent_id)
            personality = current_agent.get('personality', '친절하고 전문적인 AI 비서')

            sys_instruction = f"""
            당신은 AI Stone의 {personality} 아바타입니다.
            제공된 [정보]를 바탕으로 사용자의 질문에 답변하세요.
            만약 제공된 정보만으로는 답변할 수 없다면, '정보가 부족하여 답변하기 어렵습니다.'라고 말하세요.
            답변은 친절하고 간결하게 해주세요.
            """

            prompt = f"""
            [제공된 정보]:
            {context}

            [사용자 질문]:
            {user_question}
            """

            full_response = ''
            for chunk in client.models.generate_content_stream(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(system_instruction=sys_instruction)
            ):
                chunk_text = chunk.text
                if chunk_text:
                    chunk_text = re.sub(r'```python|```json|```text|```', '', chunk_text)
                    chunk_text = re.sub(r'\*\*(.*?)\*\*', r'\1', chunk_text)

                    full_response += chunk_text

                    yield f"data: {json.dumps({'chunk': chunk_text, 'full': full_response, 'complete': False})}\n\n"

            yield f"data: {json.dumps({'chunk': '', 'full': full_response, 'complete': True})}\n\n"

        except Exception as e:
            print(f"Error during streaming RAG process: {e}")
            yield f"data: {json.dumps({'error': '답변 생성 중 오류가 발생했습니다.'})}\n\n"

    return Response(
        generate_stream(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        }
    )

if __name__ == '__main__':
    app.run(debug=True)
