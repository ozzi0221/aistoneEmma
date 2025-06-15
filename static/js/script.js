// static/js/script.js

document.addEventListener('DOMContentLoaded', () => {
    const avatarVideo = document.getElementById('avatarVideo');
    const startButton = document.getElementById('startButton');
    const questionInput = document.getElementById('questionInput');
    const responseTextElement = document.getElementById('responseText');
    const spinner = document.querySelector('.spinner');

    let currentAgent = null;
    
    // STT 관련 변수들
    let recognition = null;
    let isListening = false;
    let micButton = null;
    let sendButton = null;
    let isProcessing = false;

    // 초기 에이전트 정보 로드
    const loadAgentInfo = async () => {
        try {
            const response = await fetch('/get_agent_info');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            currentAgent = await response.json();
            console.log("Agent info loaded:", currentAgent);

            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                try {
                    await avatarVideo.play();
                    console.log("Video auto-play successful.");
                } catch (e) {
                    console.log("Video auto-play blocked, user interaction will start video:", e);
                }
            }

        } catch (error) {
            console.error('Error loading agent info:', error);
            showNotification("에이전트 정보를 불러오는데 실패했습니다.", 'error');
        }
    };

    // Web Speech API STT 초기화
    const initializeSpeechRecognition = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech Recognition API not supported in this browser');
            return false;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'ko-KR';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            console.log('Speech recognition started');
            isListening = true;
            updateButtonStates();
            questionInput.placeholder = "음성을 인식하고 있습니다...";
            questionInput.classList.add('listening');
        };

        recognition.onresult = (event) => {
            let transcript = '';
            let isFinal = false;

            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    isFinal = true;
                }
            }

            questionInput.value = transcript;
            
            if (isFinal) {
                console.log('Final transcript:', transcript);
                questionInput.placeholder = "AI Stone에 대해 궁금한 것을 물어보세요...";
                questionInput.classList.remove('listening');
                updateButtonStates();
            }
        };

        recognition.onend = () => {
            console.log('Speech recognition ended');
            isListening = false;
            updateButtonStates();
            questionInput.placeholder = "AI Stone에 대해 궁금한 것을 물어보세요...";
            questionInput.classList.remove('listening');
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isListening = false;
            updateButtonStates();
            questionInput.classList.remove('listening');
            
            let errorMessage = "음성 인식 중 오류가 발생했습니다.";
            switch (event.error) {
                case 'no-speech':
                    errorMessage = "음성이 감지되지 않았습니다. 다시 시도해주세요.";
                    break;
                case 'audio-capture':
                    errorMessage = "마이크에 접근할 수 없습니다. 권한을 확인해주세요.";
                    break;
                case 'not-allowed':
                    errorMessage = "마이크 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.";
                    break;
                case 'network':
                    errorMessage = "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.";
                    break;
            }
            
            showNotification(errorMessage, 'error');
            setTimeout(() => {
                questionInput.placeholder = "AI Stone에 대해 궁금한 것을 물어보세요...";
            }, 3000);
        };

        return true;
    };

    // 토스트 알림 시스템
    const showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    };

    const getNotificationIcon = (type) => {
        const icons = {
            info: '💡',
            warning: '⚠️',
            error: '❌',
            success: '✅'
        };
        return icons[type] || '💡';
    };

    // 컴팩트 버튼들 생성
    const createInputButtons = () => {
        const inputContainer = questionInput.parentElement;
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'input-buttons';

        // 마이크 버튼 생성
        micButton = document.createElement('button');
        micButton.type = 'button';
        micButton.className = 'input-icon-btn mic-btn';
        micButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15C13.66 15 15 13.66 15 12V6C15 4.34 13.66 3 12 3C10.34 3 9 4.34 9 6V12C9 13.66 10.34 15 12 15Z" fill="currentColor"/>
                <path d="M17 12C17 15.31 14.31 18 11 18H13C16.31 18 19 15.31 19 12H17Z" fill="currentColor"/>
                <path d="M19 12V13C19 16.866 15.866 20 12 20C8.134 20 5 16.866 5 13V12H7V13C7 15.761 9.239 18 12 18C14.761 18 17 15.761 17 13V12H19Z" fill="currentColor"/>
                <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2"/>
            </svg>
        `;
        micButton.title = '음성으로 질문하기';
        micButton.addEventListener('click', toggleSpeechRecognition);

        // 전송 버튼 생성
        sendButton = document.createElement('button');
        sendButton.type = 'button';
        sendButton.className = 'input-icon-btn send-btn';
        sendButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
            </svg>
        `;
        sendButton.title = '질문 전송';
        sendButton.addEventListener('click', askAvatar);

        buttonsContainer.appendChild(micButton);
        buttonsContainer.appendChild(sendButton);
        inputContainer.appendChild(buttonsContainer);

        updateButtonStates();
    };

    // 버튼 상태 업데이트
    const updateButtonStates = () => {
        if (!micButton || !sendButton) return;

        const hasText = questionInput.value.trim().length > 0;

        // 마이크 버튼 상태
        if (isListening) {
            micButton.classList.add('listening');
            micButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="6" fill="currentColor"/>
                </svg>
            `;
            micButton.title = '음성 인식 중... (클릭하여 중지)';
        } else {
            micButton.classList.remove('listening');
            micButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 15C13.66 15 15 13.66 15 12V6C15 4.34 13.66 3 12 3C10.34 3 9 4.34 9 6V12C9 13.66 10.34 15 12 15Z" fill="currentColor"/>
                    <path d="M17 12C17 15.31 14.31 18 11 18H13C16.31 18 19 15.31 19 12H17Z" fill="currentColor"/>
                    <path d="M19 12V13C19 16.866 15.866 20 12 20C8.134 20 5 16.866 5 13V12H7V13C7 15.761 9.239 18 12 18C14.761 18 17 15.761 17 13V12H19Z" fill="currentColor"/>
                    <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2"/>
                </svg>
            `;
            micButton.title = '음성으로 질문하기';
        }

        // 전송 버튼 상태
        if (isProcessing) {
            sendButton.classList.add('processing');
            sendButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                        <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                        <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                    </circle>
                </svg>
            `;
            sendButton.disabled = true;
            sendButton.title = '답변 생성 중...';
        } else {
            sendButton.classList.remove('processing');
            sendButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
                </svg>
            `;
            sendButton.disabled = !hasText;
            sendButton.title = hasText ? '질문 전송' : '질문을 입력해주세요';
        }

        // 버튼 활성화 상태에 따른 스타일 적용
        sendButton.classList.toggle('active', hasText && !isProcessing);
    };

    // 음성 관리 클래스 (스트리밍 TTS 지원)
    class SpeechManager {
        constructor() {
            this.speechQueue = [];
            this.isSpeaking = false;
            this.isEnabled = true;
            this.currentUtterance = null;
        }
        
        async addToQueue(text) {
            if (!this.isEnabled || !text || text.trim().length < 2) return;
            
            this.speechQueue.push(text.trim());
            
            if (!this.isSpeaking) {
                this.processQueue();
            }
        }
        
        async processQueue() {
            this.isSpeaking = true;
            
            while (this.speechQueue.length > 0 && this.isEnabled) {
                const text = this.speechQueue.shift();
                await this.speak(text);
            }
            
            this.isSpeaking = false;
            
            // 모든 음성 재생이 끝나면 idle 비디오로 전환
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                avatarVideo.play().catch(e => console.error("Error playing idle video after speech queue completed:", e));
            }
        }
        
        async speak(text) {
            return new Promise((resolve) => {
                if (!this.isEnabled) {
                    resolve();
                    return;
                }
                
                if (!('speechSynthesis' in window)) {
                    showNotification("이 브라우저는 음성 합성을 지원하지 않습니다.", 'error');
                    resolve();
                    return;
                }
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'ko-KR';
                utterance.volume = 1;
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                
                this.currentUtterance = utterance;
                
                utterance.onstart = () => {
                    if (currentAgent && currentAgent.video_speaking) {
                        avatarVideo.src = `/static/video/${currentAgent.video_speaking}`;
                        avatarVideo.load();
                        avatarVideo.play().catch(e => console.error("Error playing speaking video:", e));
                    }
                };
                
                utterance.onend = () => {
                    this.currentUtterance = null;
                    resolve();
                };
                
                utterance.onerror = (event) => {
                    console.error('Speech synthesis error:', event.error);
                    this.currentUtterance = null;
                    resolve();
                };
                
                try {
                    speechSynthesis.speak(utterance);
                } catch (e) {
                    console.error("SpeechSynthesis.speak() call failed:", e);
                    resolve();
                }
            });
        }
        
        stop() {
            this.isEnabled = false;
            this.speechQueue = [];
            
            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
            }
            
            setTimeout(() => {
                this.isEnabled = true;
            }, 100);
            
            this.isSpeaking = false;
            this.currentUtterance = null;
        }
    }
    
    // 문장 완성 감지 함수
    const isSentenceComplete = (text) => {
        const sentenceEnders = /[.!?。！？]\s*$/;
        return sentenceEnders.test(text.trim());
    };
    
    // 전역 SpeechManager 인스턴스
    const speechManager = new SpeechManager();

    // 음성 인식 토글
    const toggleSpeechRecognition = () => {
        if (!recognition) {
            showNotification('이 브라우저에서는 음성 인식을 지원하지 않습니다.', 'error');
            return;
        }

        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (error) {
                console.error('Speech recognition start error:', error);
                showNotification('음성 인식을 시작할 수 없습니다. 마이크 권한을 확인해주세요.', 'error');
            }
        }
    };

    // TTS 음성 합성
    const speak = (text) => {
        if (!text) return;

        if (!('speechSynthesis' in window)) {
            showNotification("이 브라우저는 음성 합성을 지원하지 않습니다.", 'error');
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                avatarVideo.play().catch(e => console.error("Error playing video:", e));
            }
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
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
            showNotification("음성 재생 중 오류가 발생했습니다.", 'error');
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                avatarVideo.play().catch(e => console.error("Error playing idle video after speech error:", e));
            }
        };

        try {
            speechSynthesis.speak(utterance);
        } catch (e) {
            console.error("SpeechSynthesis.speak() call failed:", e);
            showNotification("음성 재생이 차단되었습니다. 브라우저 설정을 확인해주세요.", 'error');
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                avatarVideo.play().catch(e => console.error("Error playing idle video after speak call failed:", e));
            }
        }
    };

    // 질문 전송 및 답변 처리 (스트리밍 버전)
    const askAvatar = async () => {
        const question = questionInput.value.trim();
        if (!question) {
            showNotification('질문을 입력해주세요!', 'warning');
            questionInput.focus();
            return;
        }

        if (isProcessing) {
            showNotification('답변을 생성 중입니다. 잠시만 기다려주세요.', 'info');
            return;
        }

        isProcessing = true;
        updateButtonStates();
        
        // 기존 음성 중지
        speechManager.stop();
        
        // 응답 영역에 로딩 상태 표시
        responseTextElement.innerHTML = `
            <div class="response-loading">
                <div class="response-spinner">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                            <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                            <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                </div>
                <span>AI Stone이 답변을 생성하고 있습니다...</span>
            </div>
        `;

        // 비디오 재생 시도
        if (avatarVideo.paused || avatarVideo.ended) {
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
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
            // 스트리밍 API 호출
            const response = await fetch('/ask_avatar_stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: question }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            let currentSentence = '';
            
            // 응답 영역 초기화
            responseTextElement.innerHTML = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.error) {
                                console.error('스트리밍 오류:', data.error);
                                responseTextElement.innerHTML = data.error;
                                showNotification(data.error, 'error');
                                break;
                            }
                            
                            if (data.chunk) {
                                fullResponse = data.full;
                                currentSentence += data.chunk;
                                
                                // 텍스트 즉시 표시 (타이핑 효과 없이)
                                responseTextElement.textContent = fullResponse;
                                
                                // 문장이 완성되었는지 확인
                                if (isSentenceComplete(currentSentence)) {
                                    // 완성된 문장을 음성 큐에 추가
                                    speechManager.addToQueue(currentSentence.trim());
                                    currentSentence = '';
                                }
                            }
                            
                            if (data.complete) {
                                // 마지막 남은 텍스트도 음성으로 변환
                                if (currentSentence.trim()) {
                                    speechManager.addToQueue(currentSentence.trim());
                                }
                                break;
                            }
                        } catch (parseError) {
                            console.error('JSON 파싱 오류:', parseError);
                        }
                    }
                }
            }

            showNotification('답변이 생성되었습니다!', 'success');

        } catch (error) {
            console.error('Error asking avatar:', error);
            responseTextElement.innerHTML = "죄송합니다. 질문 처리 중 오류가 발생했습니다.";
            showNotification("질문 처리 중 오류가 발생했습니다.", 'error');
            
            if (currentAgent && currentAgent.video_idle) {
                avatarVideo.src = `/static/video/${currentAgent.video_idle}`;
                avatarVideo.load();
                avatarVideo.play().catch(e => console.error("Error playing idle video after ask error:", e));
            }
        } finally {
            isProcessing = false;
            questionInput.value = '';
            updateButtonStates();
            questionInput.focus();
        }
    };

    // 사용자가 새 질문하면 기존 응답 중단
    const handleNewQuestion = (userInput) => {
        speechManager.stop(); // 기존 음성 중단
        responseTextElement.innerHTML = ''; // 기존 텍스트 지우기
        // 새 스트리밍 시작
        askAvatar();
    };
    
    // 음성 제어 버튼 추가
    const createSpeechControls = () => {
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'speech-controls';
        controlsContainer.innerHTML = `
            <button id="toggleSpeech" class="control-btn" title="음성 ON/OFF">
                음성 ON
            </button>
            <button id="stopSpeech" class="control-btn" title="음성 중지">
                중지
            </button>
        `;
        
        // 응답 영역 위에 추가
        const responseSection = document.querySelector('.intro-text-section');
        responseSection.insertBefore(controlsContainer, responseSection.firstChild);
        
        // 이벤트 리스너 추가
        document.getElementById('toggleSpeech').addEventListener('click', () => {
            speechManager.isEnabled = !speechManager.isEnabled;
            const button = document.getElementById('toggleSpeech');
            
            if (speechManager.isEnabled) {
                button.textContent = '음성 ON';
                button.classList.remove('disabled');
            } else {
                button.textContent = '음성 OFF';
                button.classList.add('disabled');
                speechManager.stop();
            }
        });
        
        document.getElementById('stopSpeech').addEventListener('click', () => {
            speechManager.stop();
            showNotification('음성이 중지되었습니다.', 'info');
        });
    };

    // 입력 이벤트 리스너
    questionInput.addEventListener('input', updateButtonStates);
    questionInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            askAvatar();
        }
    });

    // 시작 버튼 처리
    startButton.addEventListener('click', function() {
        console.log('대화 시작 버튼 클릭됨');
        
        // UI 상태 변경
        startButton.style.display = 'none';
        questionInput.disabled = false;
        questionInput.focus();
        
        // 입력창 활성화 애니메이션
        const inputArea = document.querySelector('.question-input-area');
        inputArea.classList.add('active');
        
        responseTextElement.innerHTML = `
            <div class="welcome-message">
                <h3>🤖 AI Stone에 오신 것을 환영합니다!</h3>
                <p>음성 또는 텍스트로 질문해보세요. 친절하고 정확한 답변을 제공해드리겠습니다.</p>
            </div>
        `;
    });

    // 초기화
    loadAgentInfo();
    
    if (initializeSpeechRecognition()) {
        console.log('STT 기능이 초기화되었습니다.');
    } else {
        console.warn('STT 기능을 사용할 수 없습니다.');
    }

    // 컴팩트 버튼들 생성
    createInputButtons();
    
    // 음성 제어 버튼 생성
    createSpeechControls();

    // 전역 함수로 대화 초기화 함수 등록 (HTML에서 호출용)
    window.resetConversation = () => {
        // 대화 초기화
        questionInput.value = '';
        questionInput.disabled = true;
        responseTextElement.innerHTML = 'AI Stone에 대해 무엇이든 물어보세요. 회사 정보, 기술, 서비스 등 다양한 질문에 답변해드립니다.';
        
        // 시작 버튼 다시 표시
        startButton.style.display = 'block';
        startButton.textContent = '🚀 대화 시작하기';
        
        // 입력창 비활성화
        const inputArea = document.querySelector('.question-input-area');
        inputArea.classList.remove('active');
        
        // 상태 초기화
        isProcessing = false;
        isListening = false;
        
        // 음성 인식 중지
        if (recognition && isListening) {
            recognition.stop();
        }
        
        // 음성 관리자 초기화
        speechManager.stop();
        
        updateButtonStates();
        
        showNotification('새로운 대화가 시작되었습니다! 🎉', 'success');
        
        console.log('대화가 초기화되었습니다.');
    };
});
