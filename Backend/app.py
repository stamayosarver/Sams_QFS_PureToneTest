import os
import io
import csv
from flask import Flask, request, jsonify, send_from_directory, Response

app = Flask(__name__, static_folder="../Frontend", static_url_path="")

# In-memory storage (for demonstration purposes)
stored_results = []

@app.route('/')
def index():
    # Serve index.html from the Frontend directory
    frontend_path = os.path.join(os.path.dirname(__file__), "../Frontend")
    return send_from_directory(frontend_path, "index.html")

@app.route('/api/results', methods=['POST'])
def store_results():
    global stored_results
    data = request.get_json()
    if not data or 'results' not in data:
        return jsonify({"error": "No results provided"}), 400
    # Append the new test result iteration
    stored_results.append(data['results'])
    return jsonify({"message": "Results stored successfully"}), 200

@app.route('/api/results', methods=['GET'])
def get_results():
    return jsonify({"results": stored_results})

@app.route('/api/results/csv', methods=['GET'])
def get_results_csv():
    # Create a CSV representation of the stored results.
    proxy = io.StringIO()
    writer = csv.writer(proxy)
    writer.writerow(["Test Iteration", "Frequency (Hz)", "Threshold (Gain)"])
    for i, iteration in enumerate(stored_results, start=1):
        for row in iteration:
            writer.writerow([i, row['frequency'], row['gain']])
    csv_content = proxy.getvalue()
    proxy.close()
    return Response(csv_content, mimetype="text/csv",
                    headers={"Content-disposition": "attachment; filename=audiometry_results.csv"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0') 