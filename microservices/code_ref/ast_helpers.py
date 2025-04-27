import os
from tree_sitter_languages import get_parser


def get_language(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    return {
        ".py": "python",
        ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp",
        ".c": "c",
        ".js": "javascript",
        ".java": "java",
        ".rs": "rust",
    }.get(ext, "text")

def find_methods_with_name(node, name):
    """Finds all method nodes matching the given name."""
    nodes = []
    node_name = node.child_by_field_name('name')
    if node_name and node_name.text.decode() == name:
        nodes.append(node)
    for child in node.children:
        nodes.extend(find_methods_with_name(child, name))
    return nodes

def extract_method_parameters(node):
    """Extracts parameter types from a method node."""
    parameters = []
    params_node = node.child_by_field_name('parameters')
    if params_node:
        for child in params_node.children:
            if child.type != ',':  # Ignore commas
                param_type = child.child_by_field_name('type')
                if param_type:
                    parameters.append(param_type.text.decode())
    return parameters

def find_overloaded_method(nodes, param_types):
    """Finds the method matching the given parameter types."""
    for node in nodes:
        method_params = extract_method_parameters(node)
        if method_params == param_types:
            return node
    return nodes[0] if nodes else None  # Default to first match if no exact match
def search_for_node(node, query):
    """Handles queries like ClassName.methodName or ClassName.methodName(param1,param2)."""
    if '(' in query:
        method_query = query.split('(')[0]
        params_query = query[query.index('(') + 1:-1].strip()
        param_types = [p.strip() for p in params_query.split(',')] if params_query else []
    else:
        method_query = query
        param_types = []
    
    elems = method_query.split('.')
    class_name, method_name = elems if len(elems) == 2 else (None, elems[0])
    
    nodes = [node]
    if class_name:
        nodes = find_methods_with_name(node, class_name)
    
    method_nodes = []
    for node in nodes:
        method_nodes.extend(find_methods_with_name(node, method_name))
    
    return find_overloaded_method(method_nodes, param_types)

def get_node_source_lines(node, query):
    node = search_for_node(node, query)
    return (node.start_point[0], node.end_point[0]) if node else (0, 0)

def search_for_source(text, query, language):
    parser = get_parser(language)
    tree = parser.parse(text.encode())
    root_node = tree.root_node
    
    lines = get_node_source_lines(root_node, query)
    return "\n".join(text.split('\n')[lines[0]:lines[1] + 1])