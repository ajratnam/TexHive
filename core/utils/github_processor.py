import re
import requests
import textwrap
from core.utils.ast_helpers import get_language, search_for_source


def ensure_minted_package(content):
    if '\\usepackage{minted}' not in content:
        content = content.replace('\\begin{document}', '\\usepackage{minted}\n\\begin{document}', 1)
    return content


def process_github_commands(content):
    pattern = r'\\Github\{([^}]*)\}'

    def replace_func(match):
        arg = match.group(1).strip()
        language = "text"
        try:
            if arg.startswith("http://") or arg.startswith("https://"):
                url_pattern = r'(https://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/([^#]+))(#L(\d+)-L(\d+))?'
                m = re.match(url_pattern, arg)
                if m:
                    user = m.group(2)
                    repo = m.group(3)
                    branch = m.group(4)
                    file_path = m.group(5)
                    lstart = m.group(7)
                    lend = m.group(8)
                    raw_url = f"https://raw.githubusercontent.com/{user}/{repo}/{branch}/{file_path}"
                    r = requests.get(raw_url)
                    if r.status_code == 200:
                        file_text = r.text
                        if lstart and lend:
                            file_lines = file_text.splitlines()
                            start_line = int(lstart)
                            end_line = int(lend)
                            code_snippet = "\n".join(file_lines[start_line - 1:end_line])
                        else:
                            code_snippet = file_text
                        language = get_language(file_path)
                    else:
                        code_snippet = f"Error fetching file: HTTP {r.status_code}"
                else:
                    code_snippet = "Invalid GitHub URL format."
            else:
                if '#' in arg:
                    file_part, selector = arg.split('#', 1)
                    parts = file_part.split('/')
                    if len(parts) < 4:
                        return "Invalid GitHub shorthand format."
                    user, repo, branch = parts[0], parts[1], parts[2]
                    file_path = "/".join(parts[3:])
                    raw_url = f"https://raw.githubusercontent.com/{user}/{repo}/{branch}/{file_path}"
                    r = requests.get(raw_url)
                    if r.status_code == 200:
                        file_text = r.text
                        language = get_language(file_path)
                        
                        code_snippet = search_for_source(file_text, selector, language)
                        code_snippet = textwrap.dedent(code_snippet)
                    else:
                        code_snippet = f"Error fetching file: HTTP {r.status_code}"
                else:
                    code_snippet = "Invalid GitHub shorthand format."
        except Exception as e:
            code_snippet = f"Error processing \\Github command: {str(e)}"

        minted_block = (
                "\\begin{minted}[fontsize=\\footnotesize, breaklines, breakanywhere]{" + language + "}\n" +
                code_snippet +
                "\n\\end{minted}"
        )
        return minted_block

    new_content = re.sub(pattern, replace_func, content)
    new_content = ensure_minted_package(new_content)
    return new_content
