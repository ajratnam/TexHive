import os
from flask import Flask, send_from_directory
from core.config import Config
from core.extensions import socketio


def create_app():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    template_dir = os.path.join(base_dir, 'templates')
    static_dir = os.path.join(base_dir, 'static')

    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
    app.config.from_object(Config)

    from api.file_api import bp as file_api_bp
    app.register_blueprint(file_api_bp, url_prefix='/api')

    from routes.main import bp as main_bp
    app.register_blueprint(main_bp)

    socketio.init_app(app)

    from sockets.events import register_socket_events
    register_socket_events(socketio, app)

    @app.route('/<path:path>', methods=['GET'])
    def serve_react_app(path):
        if path and os.path.exists(os.path.join('frontend/build', path)):
            return send_from_directory('frontend/build', path)
        else:
            return send_from_directory('frontend/build', 'index.html')

    return app
