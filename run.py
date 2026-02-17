from app import create_app
import os

app = create_app()

def is_debug_mode():
    """检查是否开启调试模式"""
    try:
        with app.app_context():
            from app.models import Config
            return Config.get('debug_mode', 'false').lower() == 'true'
    except:
        return False

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    debug = is_debug_mode()
    app.run(debug=debug, host='0.0.0.0', port=port)
