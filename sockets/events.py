import os
from core.config import Config
from core.utils.file_manager import write_file
from core.utils.latex_compiler import compile_latex_file
from flask_socketio import emit

def register_socket_events(socketio, app):
    @socketio.on('update_text')
    def handle_text_update(data):
        file_path = data.get('path')
        if not file_path:
            return  # Optionally emit an error
        abs_path = os.path.join(Config.DATA_DIR, file_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        write_file(abs_path, data.get('content', ''))
        emit('update_text', data, broadcast=True, include_self=False)

    @socketio.on('compile_latex')
    def handle_compile_latex(data=None):
        ignore_warnings = data.get('ignoreWarnings', False) if data else False
        tex_file = data.get('path') if data else None
        if not tex_file or not tex_file.endswith('.tex'):
            emit('compilation_done', {'status': 'error', 'logs': 'No valid .tex file provided.'}, broadcast=True)
            return

        result = compile_latex_file(tex_file, ignore_warnings=ignore_warnings)
        emit('compilation_done', result, broadcast=True)
