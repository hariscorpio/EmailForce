// EmailForce AI Integration and Enhanced Features
// This file handles AI API calls, content editing, template management, A/B testing, and analytics

class EmailForceAI {
    constructor() {
        this.apiKey = null;
        this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
        this.templates = JSON.parse(localStorage.getItem('emailTemplates') || '[]');
        this.analytics = JSON.parse(localStorage.getItem('aiAnalytics') || '{}');
        this.abTests = JSON.parse(localStorage.getItem('abTests') || '[]');
        this.init();
    }

    init() {
        this.loadAPIKey();
        this.setupEventListeners();
        this.initializeRichTextEditor();
    }

    loadAPIKey() {
        // In production, this would be securely stored and retrieved
        this.apiKey = localStorage.getItem('openai_api_key');
        if (!this.apiKey) {
            this.showAPIKeyModal();
        }
    }

    showAPIKeyModal() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">🔑 AI API Configuration</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: var(--spacing-4);">To use AI features, please enter your OpenAI API key:</p>
                    <div class="form-group">
                        <label class="form-label">OpenAI API Key</label>
                        <input type="password" id="apiKeyInput" class="form-input" placeholder="sk-...">
                        <small class="form-help">Your API key is stored locally and never shared</small>
                    </div>
                    <div style="margin-top: var(--spacing-4);">
                        <a href="https://platform.openai.com/api-keys" target="_blank" class="btn btn-sm btn-secondary">
                            Get API Key
                        </a>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Skip for Now</button>
                    <button class="btn btn-primary" onclick="emailForceAI.saveAPIKey()">Save API Key</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    saveAPIKey() {
        const apiKey = document.getElementById('apiKeyInput').value;
        if (apiKey && apiKey.startsWith('sk-')) {
            this.apiKey = apiKey;
            localStorage.setItem('openai_api_key', apiKey);
            document.querySelector('.modal').remove();
            this.showNotification('API key saved successfully!', 'success');
        } else {
            this.showNotification('Please enter a valid OpenAI API key', 'error');
        }
    }

    async generateContent(prompt, options = {}) {
        if (!this.apiKey) {
            this.showNotification('Please configure your API key first', 'error');
            return null;
        }

        const startTime = Date.now();
        const loadingId = this.showLoading('Generating content with AI...');

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert email marketing copywriter. Create compelling, conversion-focused email content that follows email marketing best practices.'
                        },
                        {
                            role: 'user',
                            content: this.buildPrompt(prompt, options)
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                })
            });

            const data = await response.json();
            this.hideLoading(loadingId);

            if (data.error) {
                throw new Error(data.error.message);
            }

            const content = data.choices[0].message.content;
            const generationTime = Date.now() - startTime;

            // Track analytics
            this.trackGeneration({
                prompt: prompt,
                options: options,
                generationTime: generationTime,
                success: true,
                contentLength: content.length
            });

            return content;

        } catch (error) {
            this.hideLoading(loadingId);
            this.showNotification(`AI generation failed: ${error.message}`, 'error');
            
            // Track failed generation
            this.trackGeneration({
                prompt: prompt,
                options: options,
                generationTime: Date.now() - startTime,
                success: false,
                error: error.message
            });

            return null;
        }
    }

    buildPrompt(prompt, options) {
        const basePrompt = `Create email marketing content for: ${prompt}

Requirements:
- Tone: ${options.tone || 'professional'}
- Length: ${options.length || 'medium'}
- Personalization: ${options.personalization || 'standard'}
- Campaign Type: ${options.campaignType || 'general'}

Please provide:
1. Subject line (compelling and under 50 characters)
2. Preview text (under 150 characters)
3. Email body content (HTML format)
4. Call-to-action suggestions

Format the response as JSON with keys: subject, preview, body, cta.`;

        return basePrompt;
    }

    async generateSubjectLines(campaignContext) {
        const prompt = `Generate 5 compelling email subject lines for: ${campaignContext.campaignName}
        
        Context:
        - Current subject: ${campaignContext.currentSubject}
        - Audience: ${campaignContext.audience}
        - Goal: Drive engagement and conversions
        
        Requirements:
        - Under 50 characters each
        - Include emojis where appropriate
        - Create urgency without being spammy
        - A/B test friendly variations`;

        const content = await this.generateContent(prompt, {
            campaignType: 'subject-line-generation',
            length: 'short'
        });

        if (content) {
            try {
                const parsed = JSON.parse(content);
                return parsed.subjects || this.parseSubjectLinesFromText(content);
            } catch {
                return this.parseSubjectLinesFromText(content);
            }
        }

        return this.getFallbackSubjectLines(campaignContext);
    }

    parseSubjectLinesFromText(text) {
        // Extract subject lines from AI response
        const lines = text.split('\n').filter(line => 
            line.trim().length > 0 && 
            line.trim().length < 60 &&
            !line.startsWith('#') &&
            !line.startsWith('-')
        );
        return lines.slice(0, 5);
    }

    getFallbackSubjectLines(context) {
        const baseSubjects = [
            "🔥 Don't Miss Our Biggest Sale of the Year!",
            "⚡ 25% Off Everything - Limited Time Only!",
            "🎉 Summer Sale Alert: Massive Discounts Inside",
            "💥 Flash Sale: 25% Off All Products Today!",
            "🚀 Your Exclusive Summer Sale is Here!"
        ];

        if (context.audience === 'high-value') {
            baseSubjects.push("💎 VIP Access: Your Exclusive Sale is Here!");
        }

        return baseSubjects.slice(0, 5);
    }

    // Rich Text Editor Integration
    initializeRichTextEditor() {
        // Initialize Quill.js or similar rich text editor
        if (typeof Quill !== 'undefined') {
            this.editor = new Quill('#emailContentEditor', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['link', 'image'],
                        ['clean']
                    ]
                },
                placeholder: 'Start writing your email content...'
            });
        } else {
            // Fallback to contenteditable
            this.setupContentEditable();
        }
    }

    setupContentEditable() {
        const editor = document.getElementById('emailContentEditor');
        if (editor) {
            editor.contentEditable = true;
            editor.addEventListener('input', () => {
                this.autoSave();
            });
        }
    }

    // Template Management
    saveTemplate(name, content, metadata = {}) {
        const template = {
            id: Date.now(),
            name: name,
            content: content,
            metadata: {
                ...metadata,
                createdAt: new Date().toISOString(),
                usageCount: 0
            }
        };

        this.templates.push(template);
        localStorage.setItem('emailTemplates', JSON.stringify(this.templates));
        this.showNotification('Template saved successfully!', 'success');
        this.updateTemplateList();
    }

    loadTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (template) {
            if (this.editor) {
                this.editor.setContents(this.editor.clipboard.convert(template.content));
            } else {
                document.getElementById('emailContentEditor').innerHTML = template.content;
            }
            
            // Update usage count
            template.metadata.usageCount++;
            localStorage.setItem('emailTemplates', JSON.stringify(this.templates));
            
            this.showNotification('Template loaded successfully!', 'success');
        }
    }

    deleteTemplate(templateId) {
        this.templates = this.templates.filter(t => t.id !== templateId);
        localStorage.setItem('emailTemplates', JSON.stringify(this.templates));
        this.updateTemplateList();
        this.showNotification('Template deleted successfully!', 'success');
    }

    updateTemplateList() {
        const templateList = document.getElementById('templateList');
        if (templateList) {
            templateList.innerHTML = this.templates.map(template => `
                <div class="template-item">
                    <div class="template-info">
                        <h4>${template.name}</h4>
                        <p>Used ${template.metadata.usageCount} times</p>
                        <small>Created ${new Date(template.metadata.createdAt).toLocaleDateString()}</small>
                    </div>
                    <div class="template-actions">
                        <button class="btn btn-sm btn-primary" onclick="emailForceAI.loadTemplate(${template.id})">Load</button>
                        <button class="btn btn-sm btn-secondary" onclick="emailForceAI.editTemplate(${template.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="emailForceAI.deleteTemplate(${template.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        }
    }

    // A/B Testing
    createABTest(testConfig) {
        const test = {
            id: Date.now(),
            name: testConfig.name,
            type: testConfig.type, // 'subject', 'content', 'send-time'
            variants: testConfig.variants,
            audience: testConfig.audience,
            splitPercentage: testConfig.splitPercentage || 50,
            status: 'draft',
            createdAt: new Date().toISOString(),
            results: {
                variantA: { sent: 0, opens: 0, clicks: 0, conversions: 0 },
                variantB: { sent: 0, opens: 0, clicks: 0, conversions: 0 }
            }
        };

        this.abTests.push(test);
        localStorage.setItem('abTests', JSON.stringify(this.abTests));
        this.showNotification('A/B test created successfully!', 'success');
        this.updateABTestList();
    }

    startABTest(testId) {
        const test = this.abTests.find(t => t.id === testId);
        if (test) {
            test.status = 'running';
            test.startedAt = new Date().toISOString();
            localStorage.setItem('abTests', JSON.stringify(this.abTests));
            this.updateABTestList();
            this.showNotification('A/B test started!', 'success');
        }
    }

    updateABTestResults(testId, variant, metric, value) {
        const test = this.abTests.find(t => t.id === testId);
        if (test && test.results[variant]) {
            test.results[variant][metric] = value;
            localStorage.setItem('abTests', JSON.stringify(this.abTests));
            this.updateABTestList();
        }
    }

    getABTestWinner(testId) {
        const test = this.abTests.find(t => t.id === testId);
        if (test && test.results.variantA && test.results.variantB) {
            const aRate = test.results.variantA.opens / test.results.variantA.sent;
            const bRate = test.results.variantB.opens / test.results.variantB.sent;
            return aRate > bRate ? 'variantA' : 'variantB';
        }
        return null;
    }

    updateABTestList() {
        const abTestList = document.getElementById('abTestList');
        if (abTestList) {
            abTestList.innerHTML = this.abTests.map(test => `
                <div class="ab-test-item">
                    <div class="ab-test-info">
                        <h4>${test.name}</h4>
                        <p>Type: ${test.type} | Status: ${test.status}</p>
                        <small>Created ${new Date(test.createdAt).toLocaleDateString()}</small>
                    </div>
                    <div class="ab-test-actions">
                        ${test.status === 'draft' ? 
                            `<button class="btn btn-sm btn-success" onclick="emailForceAI.startABTest(${test.id})">Start Test</button>` :
                            `<button class="btn btn-sm btn-primary" onclick="emailForceAI.viewABTestResults(${test.id})">View Results</button>`
                        }
                        <button class="btn btn-sm btn-secondary" onclick="emailForceAI.editABTest(${test.id})">Edit</button>
                    </div>
                </div>
            `).join('');
        }
    }

    // Analytics Tracking
    trackGeneration(data) {
        const date = new Date().toISOString().split('T')[0];
        if (!this.analytics[date]) {
            this.analytics[date] = {
                totalGenerations: 0,
                successfulGenerations: 0,
                failedGenerations: 0,
                averageGenerationTime: 0,
                totalGenerationTime: 0,
                contentTypes: {}
            };
        }

        const dayStats = this.analytics[date];
        dayStats.totalGenerations++;
        dayStats.totalGenerationTime += data.generationTime;

        if (data.success) {
            dayStats.successfulGenerations++;
        } else {
            dayStats.failedGenerations++;
        }

        dayStats.averageGenerationTime = dayStats.totalGenerationTime / dayStats.totalGenerations;

        const contentType = data.options.campaignType || 'general';
        if (!dayStats.contentTypes[contentType]) {
            dayStats.contentTypes[contentType] = 0;
        }
        dayStats.contentTypes[contentType]++;

        localStorage.setItem('aiAnalytics', JSON.stringify(this.analytics));
    }

    getAnalyticsSummary() {
        const dates = Object.keys(this.analytics).sort().slice(-7); // Last 7 days
        const summary = {
            totalGenerations: 0,
            successRate: 0,
            averageGenerationTime: 0,
            topContentTypes: {},
            dailyStats: []
        };

        dates.forEach(date => {
            const stats = this.analytics[date];
            summary.totalGenerations += stats.totalGenerations;
            summary.dailyStats.push({ date, ...stats });
        });

        if (summary.totalGenerations > 0) {
            const totalSuccess = dates.reduce((sum, date) => 
                sum + this.analytics[date].successfulGenerations, 0);
            summary.successRate = (totalSuccess / summary.totalGenerations) * 100;

            const totalTime = dates.reduce((sum, date) => 
                sum + this.analytics[date].totalGenerationTime, 0);
            summary.averageGenerationTime = totalTime / summary.totalGenerations;
        }

        // Get top content types
        const contentTypeCounts = {};
        dates.forEach(date => {
            Object.entries(this.analytics[date].contentTypes).forEach(([type, count]) => {
                contentTypeCounts[type] = (contentTypeCounts[type] || 0) + count;
            });
        });

        summary.topContentTypes = Object.entries(contentTypeCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .reduce((obj, [type, count]) => {
                obj[type] = count;
                return obj;
            }, {});

        return summary;
    }

    // Utility Methods
    showLoading(message) {
        const loadingId = 'loading-' + Date.now();
        const loading = document.createElement('div');
        loading.id = loadingId;
        loading.className = 'loading-overlay';
        loading.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(loading);
        return loadingId;
    }

    hideLoading(loadingId) {
        const loading = document.getElementById(loadingId);
        if (loading) {
            loading.remove();
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    autoSave() {
        const content = this.editor ? 
            this.editor.root.innerHTML : 
            document.getElementById('emailContentEditor').innerHTML;
        
        localStorage.setItem('emailDraft', content);
    }

    setupEventListeners() {
        // Auto-save every 30 seconds
        setInterval(() => {
            this.autoSave();
        }, 30000);

        // Load draft on page load
        window.addEventListener('load', () => {
            const draft = localStorage.getItem('emailDraft');
            if (draft) {
                if (this.editor) {
                    this.editor.root.innerHTML = draft;
                } else {
                    document.getElementById('emailContentEditor').innerHTML = draft;
                }
            }
        });
    }
}

// Initialize the AI integration
const emailForceAI = new EmailForceAI();

// Global functions for HTML integration
window.generateSubjectLine = async function() {
    const campaignName = document.getElementById('campaignName').value;
    const currentSubject = document.getElementById('campaignSubject').value;
    const audience = document.getElementById('audienceSelect').value;
    
    const context = { campaignName, currentSubject, audience };
    const subjects = await emailForceAI.generateSubjectLines(context);
    
    if (subjects) {
        showSubjectLineOptionsModal(subjects);
    }
};

window.generateAIEmailContent = async function() {
    const form = document.getElementById('aiContentForm');
    const formData = new FormData(form);
    
    const options = {
        campaignType: document.getElementById('aiCampaignType').value,
        tone: document.getElementById('aiTone').value,
        length: 'medium',
        personalization: 'standard'
    };
    
    const prompt = `Create email content for ${options.campaignType} campaign. 
    Key message: ${document.getElementById('aiKeyMessage').value}
    CTA: ${document.getElementById('aiCTA').value}
    Additional context: ${document.getElementById('aiContext').value}`;
    
    const content = await emailForceAI.generateContent(prompt, options);
    
    if (content) {
        try {
            const parsed = JSON.parse(content);
            showGeneratedContentModal(parsed);
        } catch {
            showGeneratedContentModal({
                subject: 'Generated Subject Line',
                preview: 'Generated preview text',
                body: content,
                cta: 'Learn More'
            });
        }
    }
};

window.saveTemplate = function() {
    const name = prompt('Enter template name:');
    if (name) {
        const content = emailForceAI.editor ? 
            emailForceAI.editor.root.innerHTML : 
            document.getElementById('emailContentEditor').innerHTML;
        
        emailForceAI.saveTemplate(name, content, {
            campaignType: document.getElementById('aiCampaignType')?.value || 'general'
        });
    }
};

window.createABTest = function() {
    const testConfig = {
        name: prompt('Enter A/B test name:'),
        type: 'subject',
        variants: {
            variantA: prompt('Enter variant A:'),
            variantB: prompt('Enter variant B:')
        },
        audience: document.getElementById('audienceSelect').value,
        splitPercentage: 50
    };
    
    if (testConfig.name && testConfig.variants.variantA && testConfig.variants.variantB) {
        emailForceAI.createABTest(testConfig);
    }
}; 