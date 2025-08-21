# Welcome to your Dyad app

This project consists of a React frontend (this website) and a Python backend for web scraping. To use the application, you must run the Python backend locally on your computer.

## Running the Local Backend Server

Follow these steps to get the scraper running. You only need to do the installation step once.

### 1. Open Your Terminal

On macOS, you can find the Terminal app in `Applications > Utilities` or by searching for it with Spotlight.

### 2. Install Dependencies (First-Time Setup)

In your terminal, run the following command to install the necessary Python packages. It's recommended to do this inside a virtual environment.

```bash
pip install -r requirements.txt
```
*Note: Depending on your system, you may need to use `pip3` instead of `pip`.*

### 3. Run the Server

Once the dependencies are installed, start the server with this command:

```bash
python scraper_backend.py
```
*Note: You may need to use `python3` instead of `python`.*

The terminal will show a message indicating that the server is running on `http://127.0.0.1:5000`.

**You must keep this terminal window open while you use the app.**

### 4. Use the App

With the server running, you can now use the search features on the website. The website will communicate with your local server to fetch the data.