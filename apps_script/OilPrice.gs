/**
 * FleetRec – proxy ราคาน้ำมันบางจาก (แก้ปัญหา CORS)
 * วิธีใช้: Deploy > New deployment > Web app
 *   Execute as: Me, Who has access: Anyone
 * แล้วนำลิงก์ .../exec ไปวางในหน้าตั้งค่าของ FleetRec
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'getOilPrice';
  if (action !== 'getOilPrice') {
    return json_({ error: 'unknown action' });
  }

  var cache = CacheService.getScriptCache();
  var cached = cache.get('oilPrice');
  if (cached) {
    return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }

  var res = UrlFetchApp.fetch('https://oil-price.bangchak.co.th/ApiOilPrice2/th', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    return json_({ error: 'upstream ' + res.getResponseCode() });
  }
  var body = res.getContentText();
  cache.put('oilPrice', body, 1800); // แคช 30 นาที
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
