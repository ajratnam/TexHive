import os

from tree_sitter_languages import get_parser


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


def find_nodes_by_name(node, name):
    nodes = []
    node_name = node.child_by_field_name('name')
    if node_name:
        node_name = node_name.text.decode()
    if node_name == name:
        nodes.append(node)
    else:
        for child in node.children:
            nodes.extend(find_nodes_by_name(child, name))
    return nodes


def search_for_node(node, query):
    elems = query.split('.')
    nodes = [node]
    for elem in elems:
        new_nodes = []
        for node in nodes:
            new_nodes.extend(find_nodes_by_name(node, elem))
        nodes = new_nodes
    if node:
        return nodes[0]
    return None


def get_node_source_lines(node, query):
    node = search_for_node(node, query)
    if node:
        return node.start_point[0], node.end_point[0]
    return 0, 0


def search_for_source(text, query, language):
    parser = get_parser(language)
    tree = parser.parse(text.encode())
    root_node = tree.root_node

    lines = get_node_source_lines(root_node, query)
    return "\n".join(text.split('\n')[lines[0]:lines[1]+1])
