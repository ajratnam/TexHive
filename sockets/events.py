import os
from core.config import Config
from core.utils.file_manager import write_file
import requests
from flask_socketio import emit, join_room, leave_room


def register_socket_events(socketio, app):
    @socketio.on('update_text')
    def handle_text_update(data):
        file_path = data.get('path')
        if not file_path:
            return  # Optionally emit an error
        uid = data.get('uid') if data else None
        project = data.get('project') if data else None
        abs_path = os.path.join(Config.DATA_DIR / uid / project, file_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        write_file(abs_path, data.get('content', ''))
        emit('update_text', data, broadcast=True, include_self=False)

    @socketio.on('update_access_level')
    def handle_access_level_update(data):
        # Get project name from data
        project_name = data.get('projectName')
        if project_name:
            # Use project name as room for targeted broadcasting
            room = f"project_{project_name}"
            # Broadcast the access level change to all clients in the project room
            emit('access_level_changed', {
                'collaboratorUid': data.get('collaboratorUid'),
                'newAccessLevel': data.get('newAccessLevel'),
                'projectName': project_name
            }, room=room, broadcast=True)
        else:
            # Fallback to broadcasting to all clients if no project name
            emit('access_level_changed', {
                'collaboratorUid': data.get('collaboratorUid'),
                'newAccessLevel': data.get('newAccessLevel')
            }, broadcast=True)

    @socketio.on('join_project')
    def on_join_project(data):
        project_name = data.get('projectName')
        if project_name:
            room = f"project_{project_name}"
            join_room(room)

    @socketio.on('leave_project')
    def on_leave_project(data):
        project_name = data.get('projectName')
        if project_name:
            room = f"project_{project_name}"
            leave_room(room)

    @socketio.on('compile_latex')
    def handle_compile_latex(data=None):
        ignore_warnings = data.get('ignoreWarnings', False) if data else False
        tex_file = data.get('path') if data else None
        uid = data.get('uid') if data else None
        project = data.get('project') if data else None
        if not tex_file or not tex_file.endswith('.tex'):
            emit('compilation_done', {'status': 'error', 'logs': 'No valid .tex file provided.'}, broadcast=True)
            return

        result = requests.post("http://compile-service:8002/compile", json={"tex_file":  tex_file, "ignore_warnings": ignore_warnings, 'uid': uid, 'project': project}).json()
        emit('compilation_done', result, broadcast=True)
