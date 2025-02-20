import ast
import os
import javalang


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


def py_extract_code_with_ast(file_text, selector):
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
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and getattr(node, 'name',
                                                                                                   None) == selector:
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

def java_extract_code_with_ast(file_text, selector):
    try:
        tree = javalang.parse.parse(file_text)
    except Exception as e:
        return f"Error parsing file: {str(e)}"
    # print(tree)

    lines = file_text.split("\n")  # Split file into lines for reconstruction

    if '.' in selector:
        class_name, method_signature = selector.split('.', 1)
        method_name, param_types = java_parse_method_signature(method_signature)

        for class_decl in tree.types:
            if isinstance(class_decl, javalang.tree.ClassDeclaration) and class_decl.name == class_name:
                for member in class_decl.body:
                    if isinstance(member, javalang.tree.MethodDeclaration) and member.name == method_name:
                        method_param_types = [java_normalize_type(p.type) for p in member.parameters]

                        if method_param_types == param_types:
                            return java_extract_code_block(lines, member.position[0])

                return f"Method '{method_signature}' not found in class '{class_name}'."
        return f"Class '{class_name}' not found."

    return f"Element '{selector}' not found."

def java_parse_method_signature(method_signature):
    """Extract method name and parameter types from a signature."""
    if '(' in method_signature and method_signature.endswith(')'):
        method_name = method_signature.split('(')[0]
        param_list = method_signature[method_signature.index('(') + 1:-1].strip()

        if not param_list:
            return method_name, []

        param_types = java_split_types(param_list)
        return method_name, param_types

    return method_signature, []


def java_split_types(param_list):
    """Splits method parameter types while handling nested generic types."""
    types = []
    balance = 0
    current_type = []

    for char in param_list:
        if char == ',' and balance == 0:
            types.append(''.join(current_type).strip())
            current_type = []
        else:
            if char == '<':
                balance += 1
            elif char == '>':
                balance -= 1
            current_type.append(char)

    if current_type:
        types.append(''.join(current_type).strip())

    return types


def java_normalize_type(type_node):
    """Recursively normalizes Java types, including generics and arrays."""
    if isinstance(type_node, javalang.tree.BasicType):
        return type_node.name + "[]" * len(type_node.dimensions)

    if isinstance(type_node, javalang.tree.ReferenceType):
        base_type = type_node.name

        if type_node.arguments:
            generic_args = ",".join(
                java_normalize_type(arg.type) for arg in type_node.arguments if isinstance(arg, javalang.tree.TypeArgument)
            )
            return f"{base_type}<{generic_args}>"

        return base_type + "[]" * len(type_node.dimensions)

    if isinstance(type_node, javalang.tree.ArrayType):
        return java_normalize_type(type_node.name) + "[]" * len(type_node.dimensions)

    return str(type_node)


def java_extract_code_block(lines, start_line):
    """Extracts the block of code starting from the given line number."""
    start_index = start_line - 1
    brace_count = 0
    extracted_code = []

    for i in range(start_index, len(lines)):
        extracted_code.append(lines[i])

        if "{" in lines[i]:
            brace_count += lines[i].count("{")
        if "}" in lines[i]:
            brace_count -= lines[i].count("}")

        if brace_count == 0 and "{" in lines[start_index]:
            break

    return "\n".join(extracted_code)