from flask import Blueprint, request, jsonify
from firebase_client import get_db
from groq import Groq
import os
import json

chat_bp = Blueprint('chat', __name__)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

def format_list(data_dict):
    if not data_dict: return []
    return [{'id': k, **v} for k, v in data_dict.items()]

@chat_bp.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    restaurant_id = data.get('restaurant_id')
    messages = data.get('messages', [])
    
    if not restaurant_id:
        return jsonify({'error': 'Restaurant ID required'}), 400
        
    db_ref = get_db()
    
    # Fetch context from RTDB
    res_data = db_ref.child(f'restaurants/{restaurant_id}').get()
    if not res_data:
        return jsonify({'error': 'Restaurant not found'}), 404
        
    items = format_list(res_data.get('items'))
    
    menu_str = ""
    active_items = [i for i in items if i.get('is_enabled') is not False]
    for item in active_items:
        menu_str += f"- ID: {item['id']}, Name: {item['name']}, Desc: {item['description']}, Price: ₹{item['price']}, Type: {item.get('item_type', 'non_veg')}, Taste: {item.get('taste', 'savory')}, Spice: {item.get('spice_level', 'medium')}, Heaviness: {item.get('heaviness', 'medium')}\n"
        
    system_prompt = f"""
    You are an AI Chef and Menu Assistant for "{res_data.get('name')}".
    You must ONLY suggest items from the provided menu. Do not invent items.

    Current Menu:
    {menu_str}

    Response Guidelines:
    1. Be polite and helpful.
    2. IMPORTANT: You must ALWAYS respond in valid JSON format ONLY. Do not include markdown blocks or any other text.
    3. The JSON must follow this exact schema:
       {{
         "message": "Your conversational response to the user",
         "action": "NONE" | "ADD_ITEM",
         "item_id": "the ID of the item to add, or null if action is NONE"
       }}
    4. If the user asks to add something to their order or wishlist, set action to "ADD_ITEM" and find the exact ID of the item from the menu list provided.
    """
    
    try:
        if not client:
            return jsonify({'error': 'AI services are currently unavailable. Please configure the API key.'}), 503
            
        completion = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                *messages
            ],
            temperature=0.4,
            response_format={"type": "json_object"}
        )
        ai_message = json.loads(completion.choices[0].message.content)
        return jsonify(ai_message), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@chat_bp.route('/chat/evaluate', methods=['POST'])
def evaluate_meal():
    data = request.get_json()
    restaurant_id = data.get('restaurant_id')
    selections = data.get('selections', {})
    
    if not restaurant_id:
        return jsonify({'error': 'Restaurant ID required'}), 400
        
    db_ref = get_db()
    res_data = db_ref.child(f'restaurants/{restaurant_id}').get()
    if not res_data:
        return jsonify({'error': 'Restaurant not found'}), 404
        
    items = format_list(res_data.get('items'))
    active_items = [i for i in items if i.get('is_enabled') is not False]
    menu_str = "\n".join([f"- ID: {i['id']}, Name: {i['name']}, Course: {i.get('course_type', 'other')}, Price: ₹{i['price']}, Priority: {i.get('priority', 'medium')}, Bestseller: {i.get('is_bestseller', False)}" for i in active_items])
    
    selected_names = [v.get('name') for k, v in selections.items() if v]
    sel_str = ", ".join(selected_names)
    primary_selection = selected_names[0] if selected_names else "your selection"
    
    system_prompt = f"""
    You are an AI Menu Evaluator for "{res_data.get('name')}".
    The user has selected: {sel_str}
    
    Your task is to suggest EXACTLY ONE complementary item that would be a "perfect combination" with their current choice.
    
    STRICT PRIORITY RULES:
    1. You MUST first look for items with Priority: "high" or Bestseller: True that complement the meal.
    2. If no high-priority item fits, suggest a relevant matching item from the menu.
    
    Logic for suggestions:
    - If they have a Main Course (Curry) but no Rice/Bread, suggest a High Priority Bread/Rice.
    - If they have only Main Courses, suggest a Signature Starter or Dessert.
    - Use the phrasing: "Along with {primary_selection}, our {{{{suggested_item}}}} would be a perfect combination!"
    
    Current Menu:
    {menu_str}
    
    Response format (JSON ONLY):
    {{
      "suggestion_text": "Your persuasive suggestion using the 'perfect combination' phrasing.",
      "suggested_item_id": "The ID of the suggested item. ONLY null if the user already has a 3+ course meal."
    }}
    """
    
    try:
        if not client:
            return jsonify({'error': 'AI services are currently unavailable. Please configure the API key.'}), 503
            
        completion = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[{"role": "system", "content": system_prompt}],
            temperature=0.4,
            response_format={"type": "json_object"}
        )
        result = json.loads(completion.choices[0].message.content)
        print(f"AI Selection: {sel_str}")
        print(f"AI Result: {result}")
        # Hydrate the suggested item
        if result.get('suggested_item_id'):
            s_id = str(result['suggested_item_id']).strip()
            matched_item = next((i for i in active_items if str(i['id']).strip() == s_id), None)
            result['suggested_item'] = matched_item
            print(f"Matched Item: {matched_item['name'] if matched_item else 'None'} for ID: {s_id}")
            
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

