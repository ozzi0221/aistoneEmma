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
            
        // 전역 변수들
let isListening = false;
let isSpeaking = false;
let speechRecognition = null;
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let eventSource = null;
let ttsQueue = [];
let isProcessingTTS = false;
let isAvatarSpeaking = false; // 아바타 상태 추적용

// 설정값들
let voiceSettings = {
    rate: 0.8,
    pitch: 1.0,
    volume: 0.8,
    lang: 'ko-KR'
};

// DOM 요소들
const elements = {
    micBtn: document.getElementById('micBtn'),
    speakerBtn: document.getElementById('speakerBtn'),
    sendBtn: document.getElementById('sendBtn'),
    clearBtn: document.getElementById('clearBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    messageInput: document.getElementById('messageInput'),
    chatContainer: document.getElementById('chatContainer'),
    avatarVideo: document.getElementById('avatarVideo'),
    statusIndicator: document.getElementById('statusIndicator'),
    audioVisualizer: document.getElementById('audioVisualizer'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    youtubeModal: document.getElementById('youtubeModal'),
    settingsModal: document.getElementById('settingsModal')
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    initializeSpeechRecognition();
    loadSettings();
    checkVideoFiles();
});

// 비디오 파일 존재 확인
function checkVideoFiles() {
    const video = elements.avatarVideo;
    
    // 비디오 로드 이벤트
    video.addEventListener('loadeddata', function() {
        console.log('아바타 비디오 로드 완료');
    });
    
    // 비디오 에러 이벤트
    video.addEventListener('error', function() {
        console.log('비디오 파일이 없습니다. 대체 화면을 표시합니다.');
        showAvatarFallback('idle');
    });
    
    // 초기 비디오 재생 시도
    playIdleVideo();
}

// 앱 초기화
function initializeApp() {
    console.log('회상치료 AI 아바타 시작');
    updateStatus('대기 중');
    
    // 웰컴 메시지 애니메이션
    setTimeout(() => {
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.opacity = '1';
            welcomeMessage.style.transform = 'translateY(0)';
        }
    }, 500);
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 마이크 버튼
    elements.micBtn.addEventListener('click', toggleSpeechRecognition);
    
    // 스피커 버튼
    elements.speakerBtn.addEventListener('click', toggleSpeaker);
    
    // 전송 버튼
    elements.sendBtn.addEventListener('click', sendMessage);
    
    // 입력 필드 엔터키
    elements.messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 대화 초기화 버튼
    elements.clearBtn.addEventListener('click', clearChat);
    
    // 설정 버튼
    elements.settingsBtn.addEventListener('click', openSettingsModal);
    
    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });
    
    // 설정 슬라이더 이벤트
    setupSettingsListeners();
}

// 설정 관련 이벤트 리스너
function setupSettingsListeners() {
    const voiceSpeedSlider = document.getElementById('voiceSpeed');
    const voicePitchSlider = document.getElementById('voicePitch');
    const voiceVolumeSlider = document.getElementById('voiceVolume');
    
    if (voiceSpeedSlider) {
        voiceSpeedSlider.addEventListener('input', function() {
            voiceSettings.rate = parseFloat(this.value);
            document.getElementById('voiceSpeedValue').textContent = this.value + 'x';
            saveSettings();
        });
    }
    
    if (voicePitchSlider) {
        voicePitchSlider.addEventListener('input', function() {
            voiceSettings.pitch = parseFloat(this.value);
            document.getElementById('voicePitchValue').textContent = this.value;
            saveSettings();
        });
    }
    
    if (voiceVolumeSlider) {
        voiceVolumeSlider.addEventListener('input', function() {
            voiceSettings.volume = parseFloat(this.value);
            document.getElementById('voiceVolumeValue').textContent = this.value;
            saveSettings();
        });
    }
}

// 음성 인식 초기화
function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        speechRecognition = new SpeechRecognition();
        
        speechRecognition.continuous = false;
        speechRecognition.interimResults = false;
        speechRecognition.lang = 'ko-KR';
        
        speechRecognition.onstart = function() {
            isListening = true;
            updateStatus('듣고 있습니다', 'listening');
            elements.micBtn.classList.add('active');
            showAudioVisualizer();
        };
        
        speechRecognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            elements.messageInput.value = transcript;
            sendMessage();
        };
        
        speechRecognition.onend = function() {
            isListening = false;
            updateStatus('대기 중');
            elements.micBtn.classList.remove('active');
            hideAudioVisualizer();
        };
        
        speechRecognition.onerror = function(event) {
            console.error('음성 인식 오류:', event.error);
            isListening = false;
            updateStatus('대기 중');
            elements.micBtn.classList.remove('active');
            hideAudioVisualizer();
        };
    } else {
        console.warn('이 브라우저는 음성 인식을 지원하지 않습니다.');
        elements.micBtn.style.display = 'none';
    }
}

// 음성 인식 토글
function toggleSpeechRecognition() {
    if (!speechRecognition) return;
    
    if (isListening) {
        speechRecognition.stop();
    } else {
        if (isSpeaking) {
            stopSpeaking();
        }
        speechRecognition.start();
    }
}

// 스피커 토글
function toggleSpeaker() {
    const isActive = elements.speakerBtn.classList.contains('active');
    
    if (isActive) {
        elements.speakerBtn.classList.remove('active');
        elements.speakerBtn.innerHTML = '<i class="fas fa-volume-mute"></i><span class="btn-text">음성 출력</span>';
        stopSpeaking();
    } else {
        elements.speakerBtn.classList.add('active');
        elements.speakerBtn.innerHTML = '<i class="fas fa-volume-up"></i><span class="btn-text">음성 출력</span>';
    }
}

// 메시지 전송
function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message) return;
    
    // 사용자 메시지 추가
    addMessage(message, 'user');
    elements.messageInput.value = '';
    
    // 로딩 표시
    showLoading();
    
    // 서버에 메시지 전송
    sendToServer(message);
}

// 빠른 메시지 전송
function sendQuickMessage(message) {
    elements.messageInput.value = message;
    sendMessage();
}

// 서버로 메시지 전송 (스트리밍)
function sendToServer(message) {
    if (eventSource) {
        eventSource.close();
    }
    
    fetch('/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: message
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('서버 응답 오류');
        }
        
        hideLoading();
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let currentMessageElement = null;
        let fullResponse = '';
        
        function readStream() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    if (currentMessageElement) {
                        // 모든 TTS가 끝났을 때 idle 상태로 전환
                        setTimeout(() => {
                            if (ttsQueue.length === 0 && !isProcessingTTS) {
                                updateStatus('대기 중');
                                playIdleVideo();
                            }
                        }, 500);
                    }
                    return;
                }
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                lines.forEach(line => {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const jsonStr = line.substring(6);
                            if (jsonStr.trim()) {
                                const data = JSON.parse(jsonStr);
                                
                                if (data.type === 'sentence') {
                                    if (!currentMessageElement) {
                                        currentMessageElement = addMessage('', 'assistant');
                                    }
                                    
                                    const messageContent = currentMessageElement.querySelector('.message-content');
                                    fullResponse += data.content + ' ';
                                    messageContent.innerHTML = '<p>' + fullResponse + '</p>';
                                    
                                    // TTS 큐에 추가 (여기서는 상태 변경 안 함)
                                    if (elements.speakerBtn.classList.contains('active')) {
                                        addToTTSQueue(data.content);
                                    }
                                    
                                    // 감정 상태 분석 및 표시
                                    const emotion = analyzeResponseForEmotion(data.content);
                                    showEmotionIndicator(emotion);
                                    
                                    // 유튜브 검색어가 있으면 링크 생성
                                    if (data.youtube_search) {
                                        addYouTubeLink(messageContent, data.youtube_search);
                                    }
                                    
                                    // 메모리 키워드 표시
                                    if (data.memory_keywords && Object.keys(data.memory_keywords).length > 0) {
                                        addMemoryKeywords(messageContent, data.memory_keywords);
                                    }
                                    
                                    scrollToBottom();
                                }
                            }
                        } catch (e) {
                            console.error('JSON 파싱 오류:', e);
                        }
                    }
                });
                
                readStream();
            }).catch(error => {
                console.error('스트림 읽기 오류:', error);
                hideLoading();
                addMessage('죄송합니다. 오류가 발생했습니다.', 'assistant');
                updateStatus('대기 중');
                playIdleVideo();
            });
        }
        
        readStream();
    })
    .catch(error => {
        console.error('요청 오류:', error);
        hideLoading();
        addMessage('죄송합니다. 서버와 연결할 수 없습니다.', 'assistant');
        updateStatus('대기 중');
        playIdleVideo();
    });
}

// 메시지 추가
function addMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    
    if (type === 'user') {
        avatarDiv.innerHTML = '<i class="fas fa-user"></i>';
    } else {
        avatarDiv.innerHTML = '<i class="fas fa-heart"></i>';
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `<p>${content}</p>`;
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    elements.chatContainer.appendChild(messageDiv);
    scrollToBottom();
    
    return messageDiv;
}

// 유튜브 링크 추가
function addYouTubeLink(messageElement, searchQuery) {
    const linkDiv = document.createElement('div');
    linkDiv.className = 'youtube-link';
    linkDiv.innerHTML = `
        <button onclick="searchYouTube('${searchQuery}')" class="youtube-btn">
            <i class="fab fa-youtube"></i> "${searchQuery}" 영상 보기
        </button>
    `;
    messageElement.appendChild(linkDiv);
}

// 메모리 키워드 추가
function addMemoryKeywords(messageElement, keywords) {
    const keywordDiv = document.createElement('div');
    keywordDiv.className = 'memory-keywords';
    
    let keywordHTML = '<h4><i class="fas fa-heart"></i> 이야기 속 추억들</h4><div class="keyword-tags">';
    
    for (const [category, words] of Object.entries(keywords)) {
        for (const word of words) {
            keywordHTML += `<span class="keyword-tag">${word}</span>`;
        }
    }
    
    keywordHTML += '</div>';
    keywordDiv.innerHTML = keywordHTML;
    messageElement.appendChild(keywordDiv);
}

// 감정 상태 표시
function showEmotionIndicator(emotion) {
    const avatarContainer = document.querySelector('.avatar-container');
    let emotionIndicator = avatarContainer.querySelector('.emotion-indicator');
    
    if (!emotionIndicator) {
        emotionIndicator = document.createElement('div');
        emotionIndicator.className = 'emotion-indicator';
        avatarContainer.appendChild(emotionIndicator);
    }
    
    const emotionTexts = {
        'happy': '기뻐하며',
        'sad': '슬퍼하며', 
        'thoughtful': '생각하며',
        'nostalgic': '추억에 잠겨',
        'warm': '따뜻하게'
    };
    
    emotionIndicator.innerHTML = `
        <i class="fas fa-heart"></i>
        <span>${emotionTexts[emotion] || '공감하며'}</span>
    `;
    
    emotionIndicator.classList.add('show');
    
    // 3초 후 숨기기
    setTimeout(() => {
        emotionIndicator.classList.remove('show');
    }, 3000);
}

// 회상치료 특화 응답 분석
function analyzeResponseForEmotion(text) {
    const emotionKeywords = {
        'nostalgic': ['추억', '그때', '옛날', '어릴', '젊을', '시절'],
        'happy': ['행복', '기뻐', '좋아', '즐거', '웃음'],
        'thoughtful': ['생각', '기억', '떠올', '회상'],
        'warm': ['따뜻', '정겨', '포근', '사랑']
    };
    
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                return emotion;
            }
        }
    }
    
    return 'warm'; // 기본값
}

// 유튜브 검색
function searchYouTube(query) {
    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    
    // 모달에 검색 링크와 설명 표시
    const youtubeContainer = document.getElementById('youtubeContainer');
    youtubeContainer.innerHTML = `
        <div class="youtube-search-container">
            <div class="youtube-icon">
                <i class="fab fa-youtube"></i>
            </div>
            <h3>"${query}" 검색 결과</h3>
            <p>아래 버튼을 클릭하면 유튜브에서 관련 영상을 보실 수 있어요</p>
            <a href="${youtubeSearchUrl}" target="_blank" class="youtube-link-btn">
                <i class="fab fa-youtube"></i>
                유튜브에서 보기
            </a>
            <div class="suggested-searches">
                <p>다른 검색어도 시도해보세요:</p>
                <button onclick="searchYouTube('${query} 옛날 버전')" class="suggestion-search-btn">${query} 옛날 버전</button>
                <button onclick="searchYouTube('${query} 추억')" class="suggestion-search-btn">${query} 추억</button>
                <button onclick="searchYouTube('${query} 클래식')" class="suggestion-search-btn">${query} 클래식</button>
            </div>
        </div>
    `;
    
    openYoutubeModal();
}

// TTS 큐에 추가
function addToTTSQueue(text) {
    ttsQueue.push(text);
    if (!isProcessingTTS) {
        processTTSQueue();
    }
}

// TTS 큐 처리 - 비디오 동기화 개선
function processTTSQueue() {
    if (ttsQueue.length === 0) {
        isProcessingTTS = false;
        isSpeaking = false;
        
        // TTS 큐가 완전히 비었을 때만 idle 상태로 전환
        setTimeout(() => {
            if (ttsQueue.length === 0 && !isProcessingTTS) {
                updateStatus('대기 중');
                playIdleVideo();
            }
        }, 200);
        return;
    }
    
    isProcessingTTS = true;
    const text = ttsQueue.shift();
    
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = voiceSettings.lang;
    currentUtterance.rate = voiceSettings.rate;
    currentUtterance.pitch = voiceSettings.pitch;
    currentUtterance.volume = voiceSettings.volume;
    
    // 음성 시작 시 speaking 비디오로 전환
    currentUtterance.onstart = function() {
        console.log('TTS 시작 - speaking 비디오로 전환');
        isSpeaking = true;
        updateStatus('말하고 있습니다', 'speaking');
        playSpeakingVideo();
    };
    
    // 음성 종료 시 다음 큐 처리
    currentUtterance.onend = function() {
        console.log('TTS 종료 - 다음 큐 처리');
        isSpeaking = false;
        
        // 잠시 대기 후 다음 큐 처리
        setTimeout(() => {
            processTTSQueue();
        }, 300);
    };
    
    currentUtterance.onerror = function(event) {
        console.error('TTS 오류:', event);
        isSpeaking = false;
        setTimeout(() => {
            processTTSQueue();
        }, 300);
    };
    
    console.log('TTS 시작:', text);
    speechSynthesis.speak(currentUtterance);
}

// 음성 정지
function stopSpeaking() {
    console.log('음성 정지');
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    ttsQueue = [];
    isProcessingTTS = false;
    isSpeaking = false;
    
    // 즉시 idle 상태로 전환
    updateStatus('대기 중');
    playIdleVideo();
}

// 상태 업데이트
function updateStatus(text, type = 'idle') {
    const statusText = elements.statusIndicator.querySelector('.status-text');
    statusText.textContent = text;
    
    elements.statusIndicator.className = `status-indicator ${type}`;
}

// 아바타 비디오 제어 - 개선된 버전
function playIdleVideo() {
    console.log('Idle 비디오 재생');
    const video = elements.avatarVideo;
    video.src = '/static/videos/avatar_idle.mp4';
    video.classList.remove('speaking');
    isAvatarSpeaking = false;
    
    video.play().catch(e => {
        console.log('비디오 재생 오류:', e);
        // 비디오 파일이 없으면 정적 이미지로 대체
        showAvatarFallback('idle');
    });
}

function playSpeakingVideo() {
    console.log('Speaking 비디오 재생');
    const video = elements.avatarVideo;
    video.src = '/static/videos/avatar_speaking.mp4';
    video.classList.add('speaking');
    isAvatarSpeaking = true;
    
    video.play().catch(e => {
        console.log('비디오 재생 오류:', e);
        // 비디오 파일이 없으면 정적 이미지로 대체
        showAvatarFallback('speaking');
    });
}

// 비디오 대체 처리
function showAvatarFallback(state) {
    const avatarContainer = document.querySelector('.avatar-container');
    const existingFallback = avatarContainer.querySelector('.avatar-fallback');
    
    if (!existingFallback) {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'avatar-fallback';
        fallbackDiv.innerHTML = `
            <div class="avatar-placeholder ${state}">
                <div class="avatar-icon">
                    <i class="fas fa-heart"></i>
                </div>
                <div class="avatar-name">감정비서</div>
                <div class="avatar-status">${state === 'speaking' ? '말하고 있습니다' : '대기 중입니다'}</div>
            </div>
        `;
        
        // 비디오 숨기고 fallback 표시
        elements.avatarVideo.style.display = 'none';
        avatarContainer.appendChild(fallbackDiv);
    } else {
        // 기존 fallback 상태 업데이트
        const placeholder = existingFallback.querySelector('.avatar-placeholder');
        const statusText = existingFallback.querySelector('.avatar-status');
        
        placeholder.className = `avatar-placeholder ${state}`;
        statusText.textContent = state === 'speaking' ? '말하고 있습니다' : '대기 중입니다';
    }
}

// 음성 시각화 제어
function showAudioVisualizer() {
    elements.audioVisualizer.classList.add('active');
}

function hideAudioVisualizer() {
    elements.audioVisualizer.classList.remove('active');
}

// 로딩 표시
function showLoading() {
    elements.loadingOverlay.classList.add('show');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('show');
}

// 채팅 초기화
function clearChat() {
    if (confirm('대화 기록을 모두 삭제하시겠습니까?')) {
        // 음성 정지
        stopSpeaking();
        
        elements.chatContainer.innerHTML = `
            <div class="welcome-message">
                <div class="message assistant-message">
                    <div class="message-avatar">
                        <i class="fas fa-heart"></i>
                    </div>
                    <div class="message-content">
                        <p>안녕하세요. 저는 회상치료를 도와드리는 AI 아바타입니다.</p>
                        <p>옛날 추억이나 좋아하셨던 노래, 사진에 대해 이야기해보실까요.</p>
                        <div class="quick-suggestions">
                            <button class="suggestion-btn" onclick="sendQuickMessage('어린 시절 고향 이야기 들려주세요')">
                                <i class="fas fa-home"></i> 고향 이야기
                            </button>
                            <button class="suggestion-btn" onclick="sendQuickMessage('좋아하셨던 노래가 있나요?')">
                                <i class="fas fa-music"></i> 좋아하는 노래
                            </button>
                            <button class="suggestion-btn" onclick="sendQuickMessage('자녀분들과의 추억을 들려주세요')">
                                <i class="fas fa-users"></i> 가족 추억
                            </button>
                            <button class="suggestion-btn" onclick="sendQuickMessage('첫 월급 받으셨던 날 기억나세요?')">
                                <i class="fas fa-coins"></i> 첫 월급
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 서버에 초기화 요청
        fetch('/clear_history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        }).catch(e => console.error('히스토리 초기화 오류:', e));
    }
}

// 스크롤 하단으로
function scrollToBottom() {
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

// 모달 제어
function openYoutubeModal() {
    elements.youtubeModal.classList.add('show');
}

function closeYoutubeModal() {
    elements.youtubeModal.classList.remove('show');
    const youtubeContainer = document.getElementById('youtubeContainer');
    youtubeContainer.innerHTML = '';
}

function openSettingsModal() {
    elements.settingsModal.classList.add('show');
}

function closeSettingsModal() {
    elements.settingsModal.classList.remove('show');
}

function closeModal(modal) {
    modal.classList.remove('show');
}

// 설정 저장/로드
function saveSettings() {
    localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
}

function loadSettings() {
    const saved = localStorage.getItem('voiceSettings');
    if (saved) {
        voiceSettings = { ...voiceSettings, ...JSON.parse(saved) };
        
        // UI 업데이트
        const speedSlider = document.getElementById('voiceSpeed');
        const pitchSlider = document.getElementById('voicePitch');
        const volumeSlider = document.getElementById('voiceVolume');
        
        if (speedSlider) {
            speedSlider.value = voiceSettings.rate;
            document.getElementById('voiceSpeedValue').textContent = voiceSettings.rate + 'x';
        }
        
        if (pitchSlider) {
            pitchSlider.value = voiceSettings.pitch;
            document.getElementById('voicePitchValue').textContent = voiceSettings.pitch;
        }
        
        if (volumeSlider) {
            volumeSlider.value = voiceSettings.volume;
            document.getElementById('voiceVolumeValue').textContent = voiceSettings.volume;
        }
    }
}

// 전역 함수로 export (HTML에서 사용)
window.sendQuickMessage = sendQuickMessage;
window.searchYouTube = searchYouTube;
window.closeYoutubeModal = closeYoutubeModal;
window.closeSettingsModal = closeSettingsModal;
window.hideIOSBrowserNotice = hideIOSBrowserNotice;

// 아바타 비디오 제어 - 개선된 버전
function playIdleVideo() {
    console.log('Idle 비디오 재생');
    const video = elements.avatarVideo;
    video.src = '/static/videos/avatar_idle.mp4';
    video.classList.remove('speaking');
    isAvatarSpeaking = false;
    
    video.play().catch(e => {
        console.log('비디오 재생 오류:', e);
        // 비디오 파일이 없으면 정적 이미지로 대체
        showAvatarFallback('idle');
    });
}

function playSpeakingVideo() {
    console.log('Speaking 비디오 재생');
    const video = elements.avatarVideo;
    video.src = '/static/videos/avatar_speaking.mp4';
    video.classList.add('speaking');
    isAvatarSpeaking = true;
    
    video.play().catch(e => {
        console.log('비디오 재생 오류:', e);
        // 비디오 파일이 없으면 정적 이미지로 대체
        showAvatarFallback('speaking');
    });
}

// 비디오 대체 처리
function showAvatarFallback(state) {
    const avatarContainer = document.querySelector('.avatar-container');
    const existingFallback = avatarContainer.querySelector('.avatar-fallback');
    
    if (!existingFallback) {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'avatar-fallback';
        fallbackDiv.innerHTML = `
            <div class="avatar-placeholder ${state}">
                <div class="avatar-icon">
                    <i class="fas fa-heart"></i>
                </div>
                <div class="avatar-name">감정비서</div>
                <div class="avatar-status">${state === 'speaking' ? '말하고 있습니다' : '대기 중입니다'}</div>
            </div>
        `;
        
        // 비디오 숨기고 fallback 표시
        elements.avatarVideo.style.display = 'none';
        avatarContainer.appendChild(fallbackDiv);
    } else {
        // 기존 fallback 상태 업데이트
        const placeholder = existingFallback.querySelector('.avatar-placeholder');
        const statusText = existingFallback.querySelector('.avatar-status');
        
        placeholder.className = `avatar-placeholder ${state}`;
        statusText.textContent = state === 'speaking' ? '말하고 있습니다' : '대기 중입니다';
    }
}

// 음성 시각화 제어
function showAudioVisualizer() {
    elements.audioVisualizer.classList.add('active');
}

function hideAudioVisualizer() {
    elements.audioVisualizer.classList.remove('active');
}

// 로딩 표시
function showLoading() {
    elements.loadingOverlay.classList.add('show');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('show');
}

// 채팅 초기화
function clearChat() {
    if (confirm('대화 기록을 모두 삭제하시겠습니까?')) {
        // 음성 정지
        stopSpeaking();
        
        elements.chatContainer.innerHTML = `
            <div class="welcome-message">
                <div class="message assistant-message">
                    <div class="message-avatar">
                        <i class="fas fa-heart"></i>
                    </div>
                    <div class="message-content">
                        <p>안녕하세요. 저는 회상치료를 도와드리는 AI 아바타입니다.</p>
                        <p>옛날 추억이나 좋아하셨던 노래, 사진에 대해 이야기해보실까요.</p>
                        <div class="quick-suggestions">
                            <button class="suggestion-btn" onclick="sendQuickMessage('어린 시절 고향 이야기 들려주세요')">
                                <i class="fas fa-home"></i> 고향 이야기
                            </button>
                            <button class="suggestion-btn" onclick="sendQuickMessage('좋아하셨던 노래가 있나요?')">
                                <i class="fas fa-music"></i> 좋아하는 노래
                            </button>
                            <button class="suggestion-btn" onclick="sendQuickMessage('자녀분들과의 추억을 들려주세요')">
                                <i class="fas fa-users"></i> 가족 추억
                            </button>
                            <button class="suggestion-btn" onclick="sendQuickMessage('첫 월급 받으셨던 날 기억나세요?')">
                                <i class="fas fa-coins"></i> 첫 월급
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 서버에 초기화 요청
        fetch('/clear_history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        }).catch(e => console.error('히스토리 초기화 오류:', e));
    }
}

// 스크롤 하단으로
function scrollToBottom() {
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

// 모달 제어
function openYoutubeModal() {
    elements.youtubeModal.classList.add('show');
}

function closeYoutubeModal() {
    elements.youtubeModal.classList.remove('show');
    const youtubeContainer = document.getElementById('youtubeContainer');
    youtubeContainer.innerHTML = '';
}

function openSettingsModal() {
    elements.settingsModal.classList.add('show');
}

function closeSettingsModal() {
    elements.settingsModal.classList.remove('show');
}

function closeModal(modal) {
    modal.classList.remove('show');
}

// 설정 저장/로드
function saveSettings() {
    localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
}

function loadSettings() {
    const saved = localStorage.getItem('voiceSettings');
    if (saved) {
        voiceSettings = { ...voiceSettings, ...JSON.parse(saved) };
        
        // UI 업데이트
        const speedSlider = document.getElementById('voiceSpeed');
        const pitchSlider = document.getElementById('voicePitch');
        const volumeSlider = document.getElementById('voiceVolume');
        
        if (speedSlider) {
            speedSlider.value = voiceSettings.rate;
            document.getElementById('voiceSpeedValue').textContent = voiceSettings.rate + 'x';
        }
        
        if (pitchSlider) {
            pitchSlider.value = voiceSettings.pitch;
            document.getElementById('voicePitchValue').textContent = voiceSettings.pitch;
        }
        
        if (volumeSlider) {
            volumeSlider.value = voiceSettings.volume;
            document.getElementById('voiceVolumeValue').textContent = voiceSettings.volume;
        }
    }
}

// 전역 함수로 export (HTML에서 사용)
window.sendQuickMessage = sendQuickMessage;
window.searchYouTube = searchYouTube;
window.closeYoutubeModal = closeYoutubeModal;
window.closeSettingsModal = closeSettingsModal;
