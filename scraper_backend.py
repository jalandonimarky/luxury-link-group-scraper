from flask import Flask, request, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote

app = Flask(__name__)
CORS(app)  # ✅ Allow all origins to fix CORS issues

# ---------- CSS SELECTORS (from your inspect) ----------
# Grid item → product link + image
GRID_ITEM_LINK_SEL = (
    "div.relative.item-box.flex.items-start.lg\\:items-center.justify-center.mb-4."
    "w-2\\/5.lg\\:w-full > a"
)
GRID_ITEM_IMG_SEL = GRID_ITEM_LINK_SEL + " > img"

# Product page → price and seller
PRICE_SEL = (
    "#shopping > div > div.vx-col.w-full.mb-4 > div > "
    "div.vx-card__collapsible-content.vs-con-loading__container > div > div:nth-child(2) > "
    "div.vx-col.w-full.lg\\:w-1\\/2.lg\\:pl-6 > div:nth-child(3) > "
    "div.vx-col.w-3\\/5.lg\\:w-3\\/4 > div:nth-child(2) > "
    "span.text-2xl.lg\\:text-4xl.text-danger.font-semibold.break-words"
)
SELLER_SEL = (
    "#shopping > div > div.vx-col.w-full.mb-4 > div > "
    "div.vx-card__collapsible-content.vs-con-loading__container > div > div:nth-child(2) > "
    "div.vx-col.w-full.lg\\:w-1\\/2.lg\\:pl-6 > div:nth-child(4) > "
    "div.vx-col.w-3\\/5.lg\\:w-3\\/4 > div > a"
)

def wait(driver, timeout=15):
    return WebDriverWait(driver, timeout)

def safe_text(el):
    try:
        return el.text.strip()
    except Exception:
        return ""

def scrape_grid(driver, base_url, max_pages=1):
    """Scrape product links and image URLs from the search/listing grid."""
    driver.get(base_url)

    product_links, image_urls = [], []
    seen = set()

    for page_num in range(1, max_pages + 1):
        print(f"🔍 Scraping grid page {page_num} …")

        # Wait for grid items to render
        try:
            wait(driver, 20).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, GRID_ITEM_LINK_SEL))
            )
        except Exception as e:
            print(f"❌ Grid not loaded on page {page_num}: {e}")
            break

        # Collect links & images
        links = driver.find_elements(By.CSS_SELECTOR, GRID_ITEM_LINK_SEL)
        imgs  = driver.find_elements(By.CSS_SELECTOR, GRID_ITEM_IMG_SEL)

        for idx, a in enumerate(links):
            try:
                href = a.get_attribute("href")
                if not href or href in seen:
                    continue
                seen.add(href)
                product_links.append(href)

                # Image (align by index; fallback to nested find)
                img_src = ""
                try:
                    if idx < len(imgs):
                        img_src = imgs[idx].get_attribute("src") or ""
                    if not img_src:
                        img = a.find_element(By.TAG_NAME, "img")
                        img_src = img.get_attribute("src") or ""
                except Exception:
                    pass
                image_urls.append(img_src or "No image URL")
            except Exception as e:
                print(f"⚠️ Skipping one card: {e}")

        # Try pagination; break if none
        if page_num < max_pages:
            try:
                next_sel_candidates = [
                    "a.next-link",
                    "a[aria-label='Next']",
                    "button[aria-label='Next']",
                    "a.pagination-next",
                ]
                next_el = None
                for sel in next_sel_candidates:
                    try:
                        next_el = driver.find_element(By.CSS_SELECTOR, sel)
                        if next_el and next_el.is_displayed():
                            break
                    except Exception:
                        continue
                if next_el:
                    driver.execute_script("arguments[0].click();", next_el)
                    time.sleep(2.0)
                else:
                    print("ℹ️ No next button found. Stopping pagination.")
                    break
            except Exception as e:
                print(f"⚠️ Pagination failed: {e}")
                break

    return product_links, image_urls

def scrape_product_details(driver, product_url):
    """Open a product page and scrape product name, price, and seller."""
    try:
        driver.get(product_url)

        # Wait for either price or seller block to appear (whichever comes first)
        try:
            wait(driver, 20).until(
                EC.presence_of_any_elements_located(
                    (By.CSS_SELECTOR, f"{PRICE_SEL}, {SELLER_SEL}")
                )
            )
        except Exception:
            pass  # Proceed; we'll try to read whatever is there

        # Product name
        name = ""
        try:
            name = (driver.title or "").strip()
            for suffix in (" | FROM JAPAN", " | FromJapan", " | FROMJAPAN"):
                if name.endswith(suffix):
                    name = name[: -len(suffix)].strip()
        except Exception:
            pass
        if not name:
            try:
                h1 = driver.find_element(By.TAG_NAME, "h1")
                name = safe_text(h1)
            except Exception:
                name = "No name"

        # Price
        price = "No price"
        try:
            price_el = driver.find_element(By.CSS_SELECTOR, PRICE_SEL)
            price = safe_text(price_el) or "No price"
        except Exception:
            pass

        # Seller
        seller = "No seller"
        try:
            seller_el = driver.find_element(By.CSS_SELECTOR, SELLER_SEL)
            seller = safe_text(seller_el) or (seller_el.get_attribute("href") or "No seller")
        except Exception:
            pass

        return name, price, seller

    except Exception as e:
        print(f"❌ Error scraping product page {product_url}: {e}")
        return "No name", "No price", "No seller"

@app.route('/search', methods=['POST'])
def run_script():
    if not request.is_json:
        return jsonify({"error": "Invalid request format. Expected JSON."}), 400

    data = request.get_json()
    if not data:
        return jsonify({"error": "Empty request body. Expected JSON data."}), 400

    search_term = (data.get('search') or "").strip()
    seller_filter = (data.get('seller') or "").strip()
    seller_search = (data.get('sellerSearch') or "").strip()

    if sum([1 for var in [search_term, seller_filter, seller_search] if var]) > 1:
        return jsonify({"error": "Please use only one search method at a time."}), 400
    if not any([search_term, seller_filter, seller_search]):
        return jsonify({"error": "Please enter a search term or select a seller."}), 400

    print(f"✅ Received request: search='{search_term}', seller='{seller_filter}', sellerSearch='{seller_search}'")

    # ---- WebGL-safe Chrome options (prevents GPU/WebGL errors) ----
    chrome_options = Options()
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-webgl")
    chrome_options.add_argument("--disable-webgl2")
    chrome_options.add_argument("--disable-3d-apis")
    chrome_options.add_argument("--disable-features=VizDisplayCompositor")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-logging"])
    chrome_options.add_argument("--window-size=1920,1080")
    # chrome_options.add_argument("--headless=new")  # ← uncomment if you want headless

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

    try:
        if search_term:
            base_url = f"https://www.fromjapan.co.jp/japan/en/rakuten/search/{quote(search_term)}/-/"
        elif seller_filter:
            base_url = f"https://www.fromjapan.co.jp/japan/en/rakuten/search/-/-/?seller={quote(seller_filter)}&price_min=50000"
        else: # seller_search
            base_url = f"https://www.fromjapan.co.jp/japan/en/rakuten/search/{quote(seller_search)}/-/?price_min=50000"


        print(f"🌐 Scraping URL: {base_url}")

        # 1) Collect product links + images from grid
        product_links, image_urls = scrape_grid(driver, base_url, max_pages=1)

        if not product_links:
            return jsonify({"error": "No products found."}), 404

        # 2) Open each product page and get name/price/seller
        product_names, prices, sellers = [], [], []
        for i, url in enumerate(product_links):
            name, price, seller = scrape_product_details(driver, url)
            product_names.append(name)
            prices.append(price)
            sellers.append(seller)

        # 3) Normalize lengths (defensive)
        n = min(len(product_names), len(prices), len(product_links), len(sellers), len(image_urls))
        product_names, prices = product_names[:n], prices[:n]
        product_links, sellers, image_urls = product_links[:n], sellers[:n], image_urls[:n]

        # 4) Build payload
        formatted_data = []
        for i in range(n):
            formatted_data.append({
                "Product Name": product_names[i],
                "Price": prices[i],
                "Link": product_links[i],
                "Seller": sellers[i],
                "Image URL": image_urls[i],
            })

        # 5) Send to Google Apps Script
        script_url = "https://script.google.com/macros/s/AKfycbxHV6TuWQ-nQpmQ-5p0FDS3My1jiK2AtUlWp072tL0hlPVu661kUycXQRffeC5NIYsm/exec"
        try:
            response = requests.post(script_url, json=formatted_data)
            print("📤 Sent Data to Google Apps Script:", formatted_data)
            print("📥 Google Apps Script Response:", response.text)

            if response.status_code == 200:
                return jsonify({
                    "message": "✅ Scraping complete. Data sent to Google Apps Script.",
                    "search_url": base_url,
                    "data": formatted_data
                }), 200
            else:
                return jsonify({
                    "error": "❌ Failed to send data to Google Apps Script.",
                    "status_code": response.status_code,
                    "response_text": response.text
                }), 500
        except requests.exceptions.RequestException as e:
            print(f"❌ Error sending request to Apps Script: {e}")
            return jsonify({"error": f"Error sending request to Apps Script: {e}"}), 500

    finally:
        driver.quit()

if __name__ == "__main__":
    app.run(debug=True)