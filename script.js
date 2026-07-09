// ==================== STATE MANAGEMENT ====================
        const state = {
            messages: [],
            chatHistory: JSON.parse(localStorage.getItem('nexus_chat_history') || '[]'),
            currentChatId: null,
            agentMode: false,
            uploadedFile: null,
            isRecording: false,
            recognition: null,
            settings: JSON.parse(localStorage.getItem('nexus_settings') || '{}')
        };

        // Load settings
        if (state.settings.groqKey) document.getElementById('groqKey').value = state.settings.groqKey;
        if (state.settings.tavilyKey) document.getElementById('tavilyKey').value = state.settings.tavilyKey;
        if (state.settings.weatherKey) document.getElementById('weatherKey').value = state.settings.weatherKey;
        if (state.settings.newsKey) document.getElementById('newsKey').value = state.settings.newsKey;
        if (state.settings.hfKey) document.getElementById('hfKey').value = state.settings.hfKey;

        // ==================== UI FUNCTIONS ====================
        function showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
            toast.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${message}</span>`;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }

        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('open');
        }

        function autoResize(textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        }

        function handleKeyDown(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        }

        // ==================== CHAT MANAGEMENT ====================
        function startNewChat() {
            state.messages = [];
            state.currentChatId = null;
            state.uploadedFile = null;
            document.getElementById('messagesContainer').innerHTML = '';
            document.getElementById('messagesContainer').style.display = 'none';
            document.getElementById('welcomeScreen').style.display = 'flex';
            document.getElementById('headerTitle').textContent = 'Nexus AI';
            document.getElementById('filePreview').innerHTML = '';
            document.getElementById('messageInput').value = '';
            document.getElementById('messageInput').style.height = 'auto';
            showToast('New chat started!', 'success');
        }

        function clearChat() {
            if (state.messages.length === 0) return;
            if (confirm('Clear all messages in this chat?')) {
                state.messages = [];
                document.getElementById('messagesContainer').innerHTML = '';
                showToast('Chat cleared', 'info');
            }
        }

        function saveChatToHistory() {
            if (state.messages.length === 0) return;
            const firstUserMsg = state.messages.find(m => m.role === 'user');
            const title = firstUserMsg ? firstUserMsg.content.substring(0, 40) + '...' : 'New Chat';
            const chat = {
                id: state.currentChatId || Date.now().toString(),
                title: title,
                timestamp: Date.now(),
                messages: [...state.messages]
            };
            state.currentChatId = chat.id;
            const existingIndex = state.chatHistory.findIndex(c => c.id === chat.id);
            if (existingIndex >= 0) {
                state.chatHistory[existingIndex] = chat;
            } else {
                state.chatHistory.unshift(chat);
            }
            if (state.chatHistory.length > 50) state.chatHistory.pop();
            localStorage.setItem('nexus_chat_history', JSON.stringify(state.chatHistory));
            renderChatHistory();
        }

        function renderChatHistory() {
            const container = document.getElementById('chatHistory');
            container.innerHTML = state.chatHistory.map(chat => `
                <div class="history-item ${chat.id === state.currentChatId ? 'active' : ''}" onclick="loadChat('${chat.id}')">
                    <i class="fas fa-comment"></i>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${chat.title}</span>
                </div>
            `).join('');
        }

        function loadChat(chatId) {
            const chat = state.chatHistory.find(c => c.id === chatId);
            if (!chat) return;
            state.messages = [...chat.messages];
            state.currentChatId = chatId;
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('messagesContainer').style.display = 'block';
            document.getElementById('messagesContainer').innerHTML = '';
            state.messages.forEach(msg => renderMessage(msg));
            document.getElementById('headerTitle').textContent = chat.title;
            renderChatHistory();
            scrollToBottom();
        }

        // ==================== MESSAGE RENDERING ====================
        function renderMessage(message) {
            const container = document.getElementById('messagesContainer');
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${message.role}`;
            
            const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const avatar = message.role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
            const name = message.role === 'user' ? 'You' : 'Nexus AI';
            const agentBadge = message.agentMode ? '<span class="agent-badge"><i class="fas fa-bolt"></i>AGENT</span>' : '';
            
            let content = formatMessageContent(message.content);
            
            // Handle images
            if (message.images && message.images.length > 0) {
                content += '<div class="image-gallery">' + 
                    message.images.map(img => `<div class="gallery-item"><img src="${img}" alt="Generated image"></div>`).join('') + 
                    '</div>';
            }
            
            // Handle audio
            if (message.audioUrl) {
                content += `<audio controls style="margin-top: 12px; width: 100%; border-radius: 8px;"><source src="${message.audioUrl}" type="audio/mpeg"></audio>`;
            }
            
            msgDiv.innerHTML = `
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">
                    <div class="message-header">
                        ${name}${agentBadge}
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-text">${content}</div>
                    ${message.role === 'assistant' ? `
                    <div class="message-actions">
                        <button class="msg-action-btn" onclick="copyMessage(this)">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                        <button class="msg-action-btn" onclick="speakText('${encodeURIComponent(message.content.replace(/'/g, "\\'"))}')">
                            <i class="fas fa-volume-up"></i> Speak
                        </button>
                        <button class="msg-action-btn" onclick="regenerateMessage(${state.messages.indexOf(message)})">
                            <i class="fas fa-redo"></i> Regenerate
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
            
            container.appendChild(msgDiv);
            scrollToBottom();
        }

        function formatMessageContent(text) {
            if (!text) return '';
            
            // Escape HTML
            text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            // Code blocks
            text = text.replace(/```([\w]*)([^]*?)```/g, (match, lang, code) => {
                return `<pre><button class="copy-code-btn" onclick="copyCode(this)">Copy</button><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
            });
            
            // Inline code
            text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
            
            // Bold
            text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            
            // Italic
            text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            
            // Headers
            text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
            text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
            text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>');
            
            // Lists
            text = text.replace(/^\* (.+)$/gm, '<li>$1</li>');
            text = text.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
            text = text.replace(/<\/ul>\s*<ul>/g, '');
            
            // Numbered lists
            text = text.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
            
            // Blockquotes
            text = text.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
            
            // Links
            text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--accent-light); text-decoration: underline;">$1</a>');
            
            // Tables (simple)
            text = text.replace(/\|(.+)\|/g, (match, content) => {
                const cells = content.split('|').map(c => c.trim()).filter(c => c);
                if (cells.length === 0) return match;
                return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
            });
            
            // Paragraphs
            text = text.split('\n\n').map(p => {
                p = p.trim();
                if (!p || p.startsWith('<')) return p;
                return `<p>${p}</p>`;
            }).join('\n');
            
            // Line breaks
            text = text.replace(/\n/g, '<br>');
            
            return text;
        }

        function scrollToBottom() {
            const chatArea = document.getElementById('chatArea');
            chatArea.scrollTop = chatArea.scrollHeight;
        }

        // ==================== SEND MESSAGE ====================
        function sendQuickPrompt(prompt) {
            document.getElementById('messageInput').value = prompt;
            autoResize(document.getElementById('messageInput'));
            sendMessage();
        }

        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const content = input.value.trim();
            if (!content && !state.uploadedFile) return;
            
            const groqKey = state.settings.groqKey;
            if (!groqKey) {
                showToast('Please add your Groq API key in Settings first!', 'warning');
                openSettings();
                return;
            }
            
            // Hide welcome screen
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('messagesContainer').style.display = 'block';
            
            // Build user message content
            let userContent = content;
            if (state.uploadedFile) {
                userContent = `[File: ${state.uploadedFile.name}]\\n${content}`;
            }
            
            // Add user message
            const userMsg = {
                role: 'user',
                content: userContent,
                timestamp: Date.now()
            };
            state.messages.push(userMsg);
            renderMessage(userMsg);
            
            // Clear input
            input.value = '';
            input.style.height = 'auto';
            document.getElementById('filePreview').innerHTML = '';
            state.uploadedFile = null;
            
            // Show typing indicator
            const typingIndicator = document.getElementById('typingIndicator');
            const typingText = document.getElementById('typingText');
            typingIndicator.classList.add('active');
            
            // Determine what to do based on message content
            try {
                let response;
                
                if (content.toLowerCase().includes('generate an image') || content.toLowerCase().includes('create an image')) {
                    typingText.textContent = 'Nexus is generating images...';
                    response = await generateImage(content);
                } else if (content.toLowerCase().includes('weather')) {
                    typingText.textContent = 'Nexus is checking the weather...';
                    response = await getWeather(content);
                } else if (content.toLowerCase().includes('news')) {
                    typingText.textContent = 'Nexus is fetching news...';
                    response = await getNews(content);
                } else if (content.toLowerCase().includes('search') || content.toLowerCase().includes('look up') || content.toLowerCase().includes('find')) {
                    typingText.textContent = 'Nexus is searching the web...';
                    response = await webSearch(content);
                } else if (state.agentMode) {
                    typingText.textContent = 'Nexus Agent is reasoning...';
                    response = await agentModeResponse(content, groqKey);
                } else {
                    typingText.textContent = 'Nexus is thinking...';
                    response = await chatWithGroq(content, groqKey);
                }
                
                typingIndicator.classList.remove('active');
                
                const aiMsg = {
                    role: 'assistant',
                    content: response.text,
                    timestamp: Date.now(),
                    agentMode: state.agentMode,
                    images: response.images || null,
                    audioUrl: response.audioUrl || null
                };
                state.messages.push(aiMsg);
                renderMessage(aiMsg);
                saveChatToHistory();
                
            } catch (error) {
                typingIndicator.classList.remove('active');
                showToast('Error: ' + error.message, 'error');
                console.error(error);
            }
        }

        // ==================== API INTEGRATIONS ====================
        async function chatWithGroq(content, apiKey) {
            const systemPrompt = `You are Nexus AI, a powerful, friendly, and knowledgeable AI assistant. You can help with:
- Answering questions on any topic (science, history, tech, culture, etc.)
- Writing and debugging code in any programming language
- Creating complete websites with HTML, CSS, and JavaScript
- Data analysis and visualization
- Creative writing and brainstorming
- Math problems with step-by-step solutions
- Translation between languages
- Summarizing documents
- Travel planning, recipes, fitness routines
- Study guides and academic explanations

Always provide detailed, accurate, and helpful responses. When writing code, include complete, working examples. When explaining concepts, use clear language and examples. Format your responses with markdown for readability.`;

            const messages = [
                { role: 'system', content: systemPrompt },
                ...state.messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
            ];
            
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 4096
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to get response');
            }
            
            const data = await response.json();
            return { text: data.choices[0].message.content };
        }

        async function agentModeResponse(content, apiKey) {
            // Agent mode: AI decides which tools to use
            const agentPrompt = `You are Nexus AI in AGENT MODE. You have access to these tools:
1. web_search - Search the internet for current information
2. code_execution - Execute Python code for calculations and data analysis
3. image_generation - Generate images from text descriptions
4. weather_lookup - Get current weather for any location
5. news_fetch - Get latest news on any topic

Analyze the user's request and decide which tool(s) to use. Respond with your reasoning and the final answer. If you need to search, indicate what you searched for.`;

            const messages = [
                { role: 'system', content: agentPrompt },
                ...state.messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
            ];
            
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 4096
                })
            });
            
            const data = await response.json();
            return { text: data.choices[0].message.content };
        }

        async function generateImage(prompt) {
            const imagePrompt = prompt.replace(/generate an image of|create an image of/gi, '').trim();
            
            // Use Pollinations.ai (free, no API key needed)
            const encodedPrompt = encodeURIComponent(imagePrompt);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
            
            return {
                text: `I've generated an image based on your prompt: "${imagePrompt}"\\n\\n![Generated Image](${imageUrl})\\n\\nThe image above was created using AI image generation. You can right-click to save it or use it in your projects.`,
                images: [imageUrl]
            };
        }

        async function webSearch(query) {
            const tavilyKey = state.settings.tavilyKey;
            
            if (!tavilyKey) {
                // Fallback: Use Groq to simulate search knowledge
                const searchPrompt = `The user wants to search for: "${query}". Please provide the most accurate and up-to-date information you can about this topic. If you're uncertain about recent events, please say so.`;
                return await chatWithGroq(searchPrompt, state.settings.groqKey);
            }
            
            try {
                const response = await fetch('https://api.tavily.com/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: tavilyKey,
                        query: query.replace(/search|look up|find/gi, '').trim(),
                        search_depth: 'advanced',
                        max_results: 5
                    })
                });
                
                const data = await response.json();
                
                let resultText = `🔍 **Web Search Results**\\n\\n`;
                if (data.results && data.results.length > 0) {
                    data.results.forEach((r, i) => {
                        resultText += `${i + 1}. **[${r.title}](${r.url})**\\n${r.content}\\n\\n`;
                    });
                } else {
                    resultText += 'No results found. Let me try to answer based on my knowledge.\\n\\n';
                }
                
                // Summarize with Groq
                const summary = await chatWithGroq(`Summarize these search results in a helpful way: ${resultText}`, state.settings.groqKey);
                return { text: resultText + '\\n---\\n\\n**Summary:**\\n' + summary.text };
                
            } catch (e) {
                return await chatWithGroq(query, state.settings.groqKey);
            }
        }

        async function getWeather(query) {
            const weatherKey = state.settings.weatherKey;
            
            if (!weatherKey) {
                return { text: '⚠️ Please add your OpenWeather API key in Settings to get live weather data. You can get a free key at openweathermap.org/api\\n\\nHowever, I can tell you that to check weather, I need a city name. Please specify which city you want weather for!' };
            }
            
            try {
                const city = query.replace(/weather|in|for|get/gi, '').trim() || 'London';
                const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${weatherKey}&units=metric`);
                const data = await response.json();
                
                if (data.cod !== 200) {
                    throw new Error(data.message);
                }
                
                const weatherText = `🌤️ **Weather in ${data.name}, ${data.sys.country}**\\n\\n` +
                    `**Temperature:** ${Math.round(data.main.temp)}°C (feels like ${Math.round(data.main.feels_like)}°C)\\n` +
                    `**Condition:** ${data.weather[0].description}\\n` +
                    `**Humidity:** ${data.main.humidity}%\\n` +
                    `**Wind:** ${data.wind.speed} m/s\\n` +
                    `**Pressure:** ${data.main.pressure} hPa\\n\\n` +
                    `*Data provided by OpenWeatherMap*`;
                
                return { text: weatherText };
            } catch (e) {
                return { text: `❌ Could not fetch weather: ${e.message}. Please check your API key and try again.` };
            }
        }

        async function getNews(query) {
            const newsKey = state.settings.newsKey;
            
            if (!newsKey) {
                return { text: '⚠️ Please add your NewsData API key in Settings to get live news. You can get a free key at newsdata.io\\n\\nI can still discuss news topics based on my training data though!' };
            }
            
            try {
                const topic = query.replace(/news|about|latest/gi, '').trim() || 'technology';
                const response = await fetch(`https://newsdata.io/api/1/news?apikey=${newsKey}&q=${encodeURIComponent(topic)}&language=en&size=5`);
                const data = await response.json();
                
                let newsText = `📰 **Latest News: ${topic}**\\n\\n`;
                if (data.results && data.results.length > 0) {
                    data.results.forEach((article, i) => {
                        newsText += `${i + 1}. **[${article.title}](${article.link})**\\n`;
                        newsText += `${article.description || 'No description available'}\\n`;
                        newsText += `*Source: ${article.source_id} | ${new Date(article.pubDate).toLocaleDateString()}*\\n\\n`;
                    });
                } else {
                    newsText += 'No news found for this topic.';
                }
                
                return { text: newsText };
            } catch (e) {
                return { text: `❌ Could not fetch news: ${e.message}` };
            }
        }

 // ==================== VIDEO CREATOR ====================
        function openVideoCreator() {
            document.getElementById('videoModal').classList.add('active');
        }

        function closeVideoModal() {
            document.getElementById('videoModal').classList.remove('active');
            document.getElementById('videoOutput').style.display = 'none';
            document.getElementById('videoSteps').innerHTML = '';
            document.getElementById('videoTopic').value = '';
        }

        async function generateVideoContent() {
            const topic = document.getElementById('videoTopic').value.trim();
            const style = document.getElementById('videoStyle').value;
            const duration = document.getElementById('videoDuration').value;
            
            if (!topic) {
                showToast('Please enter a video topic!', 'warning');
                return;
            }
            
            const groqKey = state.settings.groqKey;
            if (!groqKey) {
                showToast('Please add your Groq API key first!', 'warning');
                openSettings();
                return;
            }
            
            const outputDiv = document.getElementById('videoOutput');
            const stepsDiv = document.getElementById('videoSteps');
            outputDiv.style.display = 'block';
            stepsDiv.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner" style="margin: 0 auto 16px;"></div><p>Generating your complete video package...</p></div>';
            
            try {
                // Step 1: Generate Script
                const scriptPrompt = `Create a complete YouTube video script about "${topic}". 
Style: ${style}. Duration: ${duration}.

Please provide:
1. A catchy, SEO-optimized title
2. 5-7 relevant tags
3. An engaging description (2-3 paragraphs)
4. The complete video script with timestamps
5. Visual direction notes for each section

Format clearly with headers.`;

                const scriptResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: [
                            { role: 'system', content: 'You are an expert YouTube content creator and scriptwriter.' },
                            { role: 'user', content: scriptPrompt }
                        ],
                        temperature: 0.8,
                        max_tokens: 4096
                    })
                });
                
                const scriptData = await scriptResponse.json();
                const scriptContent = scriptData.choices[0].message.content;
                
                // Step 2: Generate Visual Prompt
                const visualPrompt = `Based on this video about "${topic}", create a detailed AI image generation prompt for the video thumbnail. Make it eye-catching, professional, and YouTube-optimized. Just give me the prompt text.`;
                
                const visualResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: [
                            { role: 'system', content: 'You create amazing AI image prompts for YouTube thumbnails.' },
                            { role: 'user', content: visualPrompt }
                        ],
                        temperature: 0.9,
                        max_tokens: 500
                    })
                });
                
                const visualData = await visualResponse.json();
                const thumbnailPrompt = visualData.choices[0].message.content;
                
                // Generate thumbnail image
                const encodedPrompt = encodeURIComponent(thumbnailPrompt);
                const thumbnailUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&nologo=true&seed=${Date.now()}`;
                
                // Step 3: Generate B-roll prompts
                const brollPrompt = `For a YouTube video about "${topic}", create 5 detailed AI image generation prompts for B-roll footage/scenes. Number them 1-5. Each should be visually stunning and relevant.`;
                
                const brollResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: [
                            { role: 'system', content: 'You create B-roll visual prompts for video production.' },
                            { role: 'user', content: brollPrompt }
                        ],
                        temperature: 0.9,
                        max_tokens: 1000
                    })
                });
                
                const brollData = await brollResponse.json();
                const brollContent = brollData.choices[0].message.content;
                
                // Display results
                stepsDiv.innerHTML = `
                    <div class="video-step">
                        <div class="step-number">1</div>
                        <div class="step-content">
                            <h4>🎬 Video Script, Title & Description</h4>
                            <p>Complete script with timestamps, SEO title, tags, and description</p>
                            <div class="step-output">${scriptContent}</div>
                            <button class="msg-action-btn" onclick="copyToClipboard(this.parentElement.querySelector('.step-output').innerText)" style="margin-top: 8px;">
                                <i class="fas fa-copy"></i> Copy Script
                            </button>
                        </div>
                    </div>
                    
                    <div class="video-step">
                        <div class="step-number">2</div>
                        <div class="step-content">
                            <h4>🎨 Thumbnail Preview</h4>
                            <p>AI-generated thumbnail based on optimized prompt</p>
                            <div style="margin-top: 12px;">
                                <img src="${thumbnailUrl}" style="width: 100%; border-radius: 12px; border: 1px solid var(--glass-border);" alt="Thumbnail">
                            </div>
                            <div class="step-output" style="margin-top: 12px;"><strong>Thumbnail Prompt:</strong>\\n${thumbnailPrompt}</div>
                            <button class="msg-action-btn" onclick="window.open('${thumbnailUrl}', '_blank')" style="margin-top: 8px;">
                                <i class="fas fa-download"></i> Download Thumbnail
                            </button>
                        </div>
                    </div>
                    
                    <div class="video-step">
                        <div class="step-number">3</div>
                        <div class="step-content">
                            <h4>🎥 B-Roll Visual Prompts</h4>
                            <p>Use these prompts to generate B-roll footage images</p>
                            <div class="step-output">${brollContent}</div>
                            <button class="msg-action-btn" onclick="copyToClipboard(this.parentElement.querySelector('.step-output').innerText)" style="margin-top: 8px;">
                                <i class="fas fa-copy"></i> Copy B-Roll Prompts
                            </button>
                        </div>
                    </div>
                    
                    <div class="video-step">
                        <div class="step-number">4</div>
                        <div class="step-content">
                            <h4>✅ Next Steps</h4>
                            <p>How to create your video</p>
                            <div class="step-output">
1. Copy the script and record your voiceover (or use AI TTS)
2. Use CapCut, Premiere Pro, or DaVinci Resolve to edit
3. Download the thumbnail and use it for your video
4. Generate B-roll images using the prompts above (use Pollinations.ai or Midjourney)
5. Add background music from YouTube Audio Library or Epidemic Sound
6. Upload to YouTube with the SEO title, description, and tags provided
7. Add end screens and cards for better engagement

💡 Pro Tip: Use the script timestamps to sync your visuals perfectly!
                            </div>
                        </div>
                    </div>
                `;
                
                showToast('Video package generated successfully!', 'success');
                
            } catch (error) {
                stepsDiv.innerHTML = `<div style="color: var(--error); padding: 20px;">Error: ${error.message}</div>`;
                showToast('Error generating video content', 'error');
            }
        }

        // ==================== SETTINGS ====================
        function openSettings() {
            document.getElementById('settingsModal').classList.add('active');
        }

        function closeSettings() {
            document.getElementById('settingsModal').classList.remove('active');
        }

        function saveSettings() {
            state.settings = {
                groqKey: document.getElementById('groqKey').value.trim(),
                tavilyKey: document.getElementById('tavilyKey').value.trim(),
                weatherKey: document.getElementById('weatherKey').value.trim(),
                newsKey: document.getElementById('newsKey').value.trim(),
                hfKey: document.getElementById('hfKey').value.trim()
            };
            localStorage.setItem('nexus_settings', JSON.stringify(state.settings));
            closeSettings();
            showToast('Settings saved successfully!', 'success');
        }

        // ==================== AGENT MODE ====================
        function toggleAgentMode() {
            state.agentMode = !state.agentMode;
            const btn = document.getElementById('agentBtn');
            if (state.agentMode) {
                btn.classList.add('active');
                showToast('Agent Mode activated! AI will use tools automatically.', 'success');
            } else {
                btn.classList.remove('active');
                showToast('Agent Mode deactivated.', 'info');
            }
        }

        // ==================== FILE UPLOAD ====================
        function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            state.uploadedFile = file;
            const preview = document.getElementById('filePreview');
            preview.innerHTML = `
                <div class="file-preview">
                    <i class="fas fa-file"></i>
                    <span>${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
                    <i class="fas fa-times remove-file" onclick="removeFile()"></i>
                </div>
            `;
            showToast(`File "${file.name}" ready to upload`, 'info');
        }

        function removeFile() {
            state.uploadedFile = null;
            document.getElementById('filePreview').innerHTML = '';
            document.getElementById('fileInput').value = '';
        }

        // Drag and drop
        const inputWrapper = document.getElementById('inputWrapper');
        const dropZone = document.getElementById('dropZone');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            inputWrapper.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        inputWrapper.addEventListener('dragenter', () => dropZone.classList.add('active'));
        inputWrapper.addEventListener('dragleave', (e) => {
            if (e.relatedTarget && !inputWrapper.contains(e.relatedTarget)) {
                dropZone.classList.remove('active');
            }
        });
        inputWrapper.addEventListener('drop', (e) => {
            dropZone.classList.remove('active');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const event = { target: { files: files } };
                handleFileUpload(event);
            }
        });

        // ==================== VOICE INPUT ====================
        function toggleVoiceInput() {
            const btn = document.getElementById('voiceBtn');
            
            if (state.isRecording) {
                stopRecording();
                return;
            }
            
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                showToast('Speech recognition not supported in your browser. Try Chrome.', 'error');
                return;
            }
            
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            state.recognition = new SpeechRecognition();
            state.recognition.continuous = true;
            state.recognition.interimResults = true;
            state.recognition.lang = 'en-US';
            
            state.recognition.onstart = () => {
                state.isRecording = true;
                btn.classList.add('recording');
                btn.innerHTML = '<i class="fas fa-stop"></i>';
                showToast('Listening... Speak now!', 'info');
            };
            
            state.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                const input = document.getElementById('messageInput');
                if (finalTranscript) {
                    input.value = (input.value ? input.value + ' ' : '') + finalTranscript;
                    autoResize(input);
                }
            };
            
            state.recognition.onerror = (event) => {
                showToast('Speech recognition error: ' + event.error, 'error');
                stopRecording();
            };
            
            state.recognition.onend = () => {
                stopRecording();
            };
            
            state.recognition.start();
        }

        function stopRecording() {
            state.isRecording = false;
            const btn = document.getElementById('voiceBtn');
            btn.classList.remove('recording');
            btn.innerHTML = '<i class="fas fa-microphone"></i>';
            if (state.recognition) {
                state.recognition.stop();
                state.recognition = null;
            }
        }

        // ==================== TEXT TO SPEECH ====================
        function speakText(encodedText) {
            const text = decodeURIComponent(encodedText);
            
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text.replace(/<[^>]*>/g, '').substring(0, 500));
                utterance.rate = 1;
                utterance.pitch = 1;
                utterance.lang = 'en-US';
                window.speechSynthesis.speak(utterance);
                showToast('Speaking...', 'info');
            } else {
                showToast('Text-to-speech not supported in your browser', 'error');
            }
        }

        // ==================== UTILITY FUNCTIONS ====================
        function copyMessage(btn) {
            const content = btn.closest('.message-content').querySelector('.message-text').innerText;
            copyToClipboard(content);
        }

        function copyCode(btn) {
            const code = btn.nextElementSibling.innerText;
            copyToClipboard(code);
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 2000);
        }

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copied to clipboard!', 'success');
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('Copied to clipboard!', 'success');
            });
        }

        async function regenerateMessage(index) {
            if (index < 0 || index >= state.messages.length) return;
            
            // Remove the message and all after it
            state.messages = state.messages.slice(0, index);
            
            // Re-render
            document.getElementById('messagesContainer').innerHTML = '';
            state.messages.forEach(msg => renderMessage(msg));
            
            // Get the last user message to regenerate response
            const lastUserMsg = [...state.messages].reverse().find(m => m.role === 'user');
            if (lastUserMsg) {
                document.getElementById('messageInput').value = lastUserMsg.content;
                sendMessage();
            }
        }

        // ==================== INITIALIZATION ====================
        renderChatHistory();
        
        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        });

        // Check for API key on load
        if (!state.settings.groqKey) {
            setTimeout(() => {
                showToast('Welcome! Please add your Groq API key in Settings to start chatting.', 'info');
            }, 1000);
        }

        console.log('%c🤖 Nexus AI Loaded!', 'color: #6366f1; font-size: 20px; font-weight: bold;');
        console.log('%cFeatures: Chat | Code | Websites | Images | Videos | Search | Voice | Agent Mode', 'color: #a855f7; font-size: 12px;');
