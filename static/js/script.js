// static/js/script.js
document.addEventListener('DOMContentLoaded', () => {
    const avatarVideo = document.getElementById('avatarVideo');
    const startButton = document.getElementById('startButton'); // 이제 '질문하기' 버튼 역할
    const questionInput = document.getElementById('questionInput');
    const responseTextElement = document.getElementById('responseText');
    const spinner = document.querySelector('.spinner'); 

    let currentAgent = null; // 현재 에이전트 정보를 저장할 변수

    // 초기 에이전트 정보 로드 (비디오 소스 설정만)
    const loadAgentInfo = async () => {
        try {
            const response = await fetch('/get_agent_info');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            currentAgent = await response.json();
            console.log("Agent info loaded:", currentAgent);

            // 비디오 소스 설정 및 자동 재생 시도 (실패해도 초기 인사말은 없음)
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                try {
                    await avatarVideo.play();
                    console.log("Video auto-play successful.");
                } catch (e) {
                    console.log("Video auto-play blocked, user interaction will start video:", e);
                    // 자동 재생이 막혀도 괜찮음. 첫 질문 시도 시 비디오가 재생될 것임.
                }
            }

        } catch (error) {
            console.error('Error loading agent info:', error);
            responseTextElement.innerText = "에이전트 정보를 불러오는데 실패했습니다.";
        }
    };

    // 텍스트를 음성으로 변환하고 아바타 비디오를 제어하는 함수
    const speak = (text) => {
        if (!text) return;

        if (spinner) { // 스피너가 존재하면 숨기기 (음성이 시작될 예정이므로)
            spinner.style.display = 'none';
        }
        
        if (!('speechSynthesis' in window)) {
            responseTextElement.innerText = "죄송합니다. 이 브라우저는 음성 합성을 지원하지 않습니다.";
            console.error("Speech synthesis not supported in this browser.");
            // 비디오를 idle로 되돌림
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                avatarVideo.play().catch(e => console.error("Error playing video:", e));
            }
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR'; // 한국어 설정
        utterance.volume = 1; 
        utterance.rate = 1; 
        utterance.pitch = 1; 

        utterance.onstart = () => {
            if (currentAgent && currentAgent.video_speaking) {
                avatarVideo.src = `/static/video/${currentAgent.video_speaking}`;
                avatarVideo.load();
                avatarVideo.play().catch(e => console.error("Error playing speaking video:", e));
            }
        };

        utterance.onend = () => {
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                avatarVideo.play().catch(e => console.error("Error playing idle video:", e));
            }
        };

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                avatarVideo.play().catch(e => console.error("Error playing idle video after speech error:", e));
            }
            responseTextElement.innerText = "음성 재생 중 오류가 발생했습니다. (브라우저 정책 문제일 수 있습니다) 텍스트로 확인해주세요.";
        };

        try {
            speechSynthesis.speak(utterance);
        } catch (e) {
            console.error("SpeechSynthesis.speak() call failed:", e);
            responseTextElement.innerText = "음성 재생이 차단되었습니다. 브라우저 설정을 확인해주세요.";
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                avatarVideo.play().catch(e => console.error("Error playing idle video after speak call failed:", e));
            }
        }
    };

    // 사용자 질문 전송 및 답변 처리 함수
    const askAvatar = async () => {
        const question = questionInput.value.trim();
        if (!question) {
            alert('질문을 입력해주세요!');
            return;
        }

        responseTextElement.innerText = "답변을 생성 중입니다...";
        if (spinner) { // 스피너가 존재하면 표시
            spinner.style.display = 'block';
        }
        
        // 질문이 시작되면 비디오 재생을 시도
        if (avatarVideo.paused || avatarVideo.ended) {
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`; // idle로 설정 후 재생 시도
                avatarVideo.load();
                try {
                    await avatarVideo.play();
                    console.log("Video started on user question.");
                } catch (e) {
                    console.error("Video play blocked on user question:", e);
                }
            }
        }

        try {
            const response = await fetch('/ask_avatar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: question }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            responseTextElement.innerText = data.response; // 답변 표시
            speak(data.response); // 답변 음성 재생

        } catch (error) {
            console.error('Error asking avatar:', error);
            responseTextElement.innerText = "죄송합니다. 질문 처리 중 오류가 발생했습니다.";
            if (spinner) { // 스피너가 존재하면 숨기기
                spinner.style.display = 'none';
            }
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                avatarVideo.play().catch(e => console.error("Error playing idle video after ask error:", e));
            }
        } finally {
            questionInput.value = ''; // 입력창 비우기
        }
    };

    // 이벤트 리스너 설정
    startButton.addEventListener('click', askAvatar); 

    questionInput.addEventListener('keypress', (event) => { 
        if (event.key === 'Enter') {
            askAvatar();
        }
    });

    loadAgentInfo(); // 페이지 로드 시 에이전트 정보 로드
});