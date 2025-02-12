(function() {
    // Retrieve the saved theme from localStorage or default to dark.
    const savedTheme = localStorage.getItem('theme') || 'dark';
    let initialMonacoTheme;
    if (savedTheme === 'light') {
        initialMonacoTheme = 'vs';
    } else if (savedTheme === 'solarized') {
        initialMonacoTheme = 'solarized';
    } else if (savedTheme === 'dracula') {
        initialMonacoTheme = 'dracula';
    } else if (savedTheme === 'monokai') {
        initialMonacoTheme = 'monokai';
    } else if (savedTheme === 'nord') {
        initialMonacoTheme = 'nord';
    } else if (savedTheme === 'gruvbox') {
        initialMonacoTheme = 'gruvbox';
    } else if (savedTheme === 'cobalt') {
        initialMonacoTheme = 'cobalt';
    } else {
        initialMonacoTheme = 'vs-dark';
    }
    window.initialMonacoTheme = initialMonacoTheme;

    // Remove any previously set theme classes
    document.documentElement.classList.remove(
        "light-theme",
        "solarized-theme",
        "dracula-theme",
        "monokai-theme",
        "nord-theme",
        "gruvbox-theme",
        "cobalt-theme"
    );
    if (savedTheme !== "dark") {
        document.documentElement.classList.add(savedTheme + "-theme");
    }

    // Expose function to update the Monaco editor theme.
    window.updateEditorTheme = function(theme) {
        if (!window.editor) return;
        if (theme === 'light') {
            monaco.editor.setTheme('vs');
        } else if (theme === 'solarized') {
            monaco.editor.defineTheme('solarized', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    {token: '', foreground: '839496', background: '002b36'},
                    {token: 'keyword', foreground: '268bd2'},
                    {token: 'comment', foreground: '586e75'},
                    {token: 'string', foreground: '2aa198'},
                    {token: 'delimiter', foreground: '93a1a1'}
                ],
                colors: {
                    'editor.background': '#002b36'
                }
            });
            monaco.editor.setTheme('solarized');
        } else if (theme === 'dracula') {
            monaco.editor.defineTheme('dracula', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    {token: '', foreground: 'f8f8f2', background: '282a36'},
                    {token: 'keyword', foreground: 'ff79c6'},
                    {token: 'comment', foreground: '6272a4'},
                    {token: 'string', foreground: 'f1fa8c'},
                    {token: 'delimiter', foreground: '8be9fd'}
                ],
                colors: {
                    'editor.background': '#282a36'
                }
            });
            monaco.editor.setTheme('dracula');
        } else if (theme === 'monokai') {
            monaco.editor.defineTheme('monokai', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    {token: '', foreground: 'f8f8f2', background: '272822'},
                    {token: 'keyword', foreground: 'f92672'},
                    {token: 'comment', foreground: '75715e'},
                    {token: 'string', foreground: 'e6db74'},
                    {token: 'delimiter', foreground: 'f8f8f0'}
                ],
                colors: {
                    'editor.background': '#272822'
                }
            });
            monaco.editor.setTheme('monokai');
        } else if (theme === 'nord') {
            monaco.editor.defineTheme('nord', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    {token: '', foreground: 'd8dee9', background: '2e3440'},
                    {token: 'keyword', foreground: '81a1c1'},
                    {token: 'comment', foreground: '4c566a'},
                    {token: 'string', foreground: 'a3be8c'},
                    {token: 'delimiter', foreground: '88c0d0'}
                ],
                colors: {
                    'editor.background': '#2e3440'
                }
            });
            monaco.editor.setTheme('nord');
        } else if (theme === 'gruvbox') {
            monaco.editor.defineTheme('gruvbox', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    {token: '', foreground: 'ebdbb2', background: '282828'},
                    {token: 'keyword', foreground: 'fb4934'},
                    {token: 'comment', foreground: 'a89984'},
                    {token: 'string', foreground: 'b8bb26'},
                    {token: 'delimiter', foreground: 'fabd2f'}
                ],
                colors: {
                    'editor.background': '#282828'
                }
            });
            monaco.editor.setTheme('gruvbox');
        } else if (theme === 'cobalt') {
            monaco.editor.defineTheme('cobalt', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    {token: '', foreground: 'ffffff', background: '002240'},
                    {token: 'keyword', foreground: 'ff9d00'},
                    {token: 'comment', foreground: '8ea9c4'},
                    {token: 'string', foreground: '7ec699'},
                    {token: 'delimiter', foreground: 'ffa7c4'}
                ],
                colors: {
                    'editor.background': '#002240'
                }
            });
            monaco.editor.setTheme('cobalt');
        } else {
            monaco.editor.setTheme('vs-dark');
        }
    };

    // Expose function to apply the selected theme (adjusting both the document’s classes and the editor).
    window.applyTheme = function(theme) {
        document.body.classList.remove(
            "light-theme",
            "solarized-theme",
            "dracula-theme",
            "monokai-theme",
            "nord-theme",
            "gruvbox-theme",
            "cobalt-theme"
        );
        if (theme !== "dark") {
            document.body.classList.add(theme + "-theme");
        }
        window.updateEditorTheme(theme);
    };

    // Wait for the DOM to be ready to attach event listeners.
    document.addEventListener("DOMContentLoaded", () => {
        const themeSelector = document.getElementById("theme-selector");
        const savedTheme = localStorage.getItem("theme") || "dark";
        window.applyTheme(savedTheme);
        themeSelector.value = savedTheme;

        themeSelector.addEventListener("change", () => {
            const selectedTheme = themeSelector.value;
            window.applyTheme(selectedTheme);
            localStorage.setItem("theme", selectedTheme);
        });
    });
})();
