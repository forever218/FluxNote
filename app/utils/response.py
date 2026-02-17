from flask import jsonify

def api_response(data=None, code=200, message="success"):
    """
    Standardize API response format.
    
    Args:
        data: The payload to return in the 'data' field.
        code (int): The HTTP status code and custom 'code' field. Defaults to 200.
        message (str): A message describing the result. Defaults to "success".
        
    Returns:
        Response: A Flask JSON response object.
    """
    response_body = {
        "code": code,
        "message": message,
        "data": data
    }
    return jsonify(response_body), code

def api_error(message="Internal Server Error", code=500, data=None):
    """
    Standardize API error response format.
    """
    return api_response(data=data, code=code, message=message)
