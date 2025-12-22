import sys
from bs4 import BeautifulSoup

def analyze_feedback(file_path):
    with open(file_path, 'r', encoding='gb18030', errors='ignore') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Remove script and style elements
    for script_or_style in soup(['script', 'style']):
        script_or_style.decompose()
        
    body = soup.find('body')
    if not body:
        return "No body found"
        
    elements = body.find_all(['p', 'div', 'span', 'img'])
    
    feedback_flow = []
    last_img = None
    
    # Word often wraps things in weird ways, let's try a simpler approach
    # We want to find the sequence of images and the text that follows them
    
    for element in body.descendants:
        if element.name == 'img':
            src = element.get('src')
            if src:
                last_img = src
                feedback_flow.append(f"IMAGE: {src}")
        elif element.name in ['p', 'div', 'span'] and element.string:
            text = element.get_text().strip()
            if text:
                feedback_flow.append(f"TEXT: {text}")
        elif isinstance(element, str):
            text = element.strip()
            if text and len(text) > 2: # Ignore very short strings
                feedback_flow.append(f"STRING: {text}")

    return "\n".join(feedback_flow)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(analyze_feedback(sys.argv[1]))
    else:
        print("Please provide a file path.")
