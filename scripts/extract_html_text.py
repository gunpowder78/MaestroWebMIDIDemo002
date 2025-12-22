import sys
from bs4 import BeautifulSoup

def extract_text(file_path):
    with open(file_path, 'r', encoding='gb18030', errors='ignore') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Remove script and style elements
    for script_or_style in soup(['script', 'style']):
        script_or_style.decompose()
        
    text = soup.get_text(separator='\n')
    
    # Clean up whitespace
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    text = '\n'.join(chunk for chunk in chunks if chunk)
    
    return text

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(extract_text(sys.argv[1]))
    else:
        print("Please provide a file path.")
