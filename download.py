import urllib.request
import zipfile
import io
import os
import shutil

url = "https://github.com/Armpjsf/FleetRec/archive/refs/heads/main.zip"
extract_dir = r"c:\Users\Armdd\All Project\FleetRec"

print("Downloading zip from:", url)
try:
    with urllib.request.urlopen(url) as response:
        zip_data = response.read()
    print("Download completed. Size:", len(zip_data))
    
    with zipfile.ZipFile(io.BytesIO(zip_data)) as zip_ref:
        # The zip file contains a top-level directory like "FleetRec-main"
        # We want to extract it and move the contents up to extract_dir
        zip_ref.extractall(extract_dir)
    print("Extraction completed.")
    
    # Move files from FleetRec-main to extract_dir
    extracted_subdir = os.path.join(extract_dir, "FleetRec-main")
    if os.path.exists(extracted_subdir):
        for item in os.listdir(extracted_subdir):
            s = os.path.join(extracted_subdir, item)
            d = os.path.join(extract_dir, item)
            if os.path.exists(d):
                if os.path.isdir(d):
                    shutil.rmtree(d)
                else:
                    os.remove(d)
            shutil.move(s, d)
        os.rmdir(extracted_subdir)
        print("Moved files to root FleetRec directory.")
    else:
        print("Warning: FleetRec-main not found in zip.")
except Exception as e:
    print("Error:", e)
