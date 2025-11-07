/**
 * Apps Script to log webhooks into Google Sheets
 * 1) Create a new Google Sheet. Name the first sheet 'Log'
 * 2) Extensions -> Apps Script -> paste this code
 * 3) Deploy -> New deployment -> Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4) Copy the Web App URL and paste it in the app (Webhook field). 
 */
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Log') || ss.insertSheet('Log');
  var body = e.postData && e.postData.contents ? e.postData.contents : '{}';
  var obj;
  try { obj = JSON.parse(body); } catch (err) { obj = { raw: body }; }
  var ts = new Date();
  var row = [
    ts,
    obj.type || 'event',
    obj.userId || '',
    obj.role || '',
    obj.text || obj.payload || '',
    JSON.stringify(obj || {})
  ];
  sh.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ ok:true })).setMimeType(ContentService.MimeType.JSON);
}
