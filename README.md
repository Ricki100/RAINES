# Data Merge Tool

A web-based tool for merging CSV data with image templates, similar to Adobe InDesign's Data Merge functionality.

## Features

- Upload a background image template (e.g., certificate, invitation)
- Upload CSV data with column headers
- Place and configure text boxes on the template
- Map CSV columns to text boxes
- Preview merged results
- Generate multiple images with different data

## Installation

1. Clone this repository
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

1. Start the Flask server:
   ```bash
   python app.py
   ```

2. Open your web browser and navigate to `http://localhost:5000`

3. Follow these steps:
   - Upload your background image template
   - Upload your CSV file with data
   - Add text boxes to the template and configure them
   - Map CSV columns to text boxes
   - Generate the merged images

## CSV Format

Your CSV file should have column headers that match the data you want to merge. For example:

```csv
Name,Date,Location
John Doe,2023-12-31,New York
Jane Smith,2024-01-01,Los Angeles
```

## Output

Generated images will be saved in the `uploads/output` directory as PNG files.

## Requirements

- Python 3.7+
- Flask
- Pillow (PIL)
- pandas
- Modern web browser

## License

MIT License 