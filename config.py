# config.py
# config.py
import os

# Gemini API Key 설정
# 환경 변수에서 API 키를 가져옵니다.
# 'GOOGLE_API_KEY' 환경 변수에 설정된 값을 사용합니다.
GEMINI_API_KEY = os.getenv('GOOGLE_API_KEY')
if not GEMINI_API_KEY:
    # 환경 변수가 설정되지 않았을 경우 에러 메시지를 출력하고 종료합니다.
    # 배포 환경에서는 이 부분이 중요합니다.
    raise ValueError("GOOGLE_API_KEY 환경 변수가 설정되지 않았습니다. API 키를 설정해주세요.")

# ... (나머지 설정들) ...

# RAG 시스템 설정 (필요에 따라 조정 가능)
CHUNK_SIZE = 1000  # 문서를 나눌 청크의 최대 문자 수
CHUNK_OVERLAP = 200 # 청크 간의 겹치는 문자 수 (문맥 유지에 도움)
TOP_K_RETRIEVAL = 3 # 질문에 대해 가장 관련성 높은 청크를 몇 개 가져올지