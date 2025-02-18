import ast
import os
import textwrap

def get_language(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".py":
        return "python"
    elif ext in [".cpp", ".cc", ".cxx"]:
        return "cpp"
    elif ext == ".c":
        return "c"
    elif ext == ".js":
        return "javascript"
    elif ext in [".html", ".htm"]:
        return "html"
    elif ext == ".css":
        return "css"
    elif ext == ".java":
        return "java"
    else:
        return "text"

def get_source_segment(source, node):
    lines = source.splitlines()
    if hasattr(node, 'lineno') and hasattr(node, 'end_lineno'):
        return "\n".join(lines[node.lineno - 1: node.end_lineno])
    else:
        return "Source segment not available."

def extract_code_with_ast(file_text, selector):
    try:
        tree = ast.parse(file_text)
    except Exception as e:
        return f"Error parsing file: {str(e)}"

    if '.' in selector:
        class_name, member_name = selector.split('.', 1)
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == class_name:
                for subnode in node.body:
                    if isinstance(subnode, (ast.FunctionDef, ast.AsyncFunctionDef)) and subnode.name == member_name:
                        return get_source_segment(file_text, subnode)
                    if isinstance(subnode, ast.Assign):
                        for target in subnode.targets:
                            if isinstance(target, ast.Name) and target.id == member_name:
                                return get_source_segment(file_text, subnode)
                return f"Member '{member_name}' not found in class '{class_name}'."
        return f"Class '{class_name}' not found."
    else:
        for node in tree.body:
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and getattr(node, 'name', None) == selector:
                return get_source_segment(file_text, node)
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == selector:
                        return get_source_segment(file_text, node)
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                for subnode in node.body:
                    if isinstance(subnode, (ast.FunctionDef, ast.AsyncFunctionDef)) and subnode.name == selector:
                        return get_source_segment(file_text, subnode)
                    if isinstance(subnode, ast.Assign):
                        for target in subnode.targets:
                            if isinstance(target, ast.Name) and target.id == selector:
                                return get_source_segment(file_text, subnode)
        return f"Element '{selector}' not found."
