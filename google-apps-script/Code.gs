/**
 * Sindhuja Finance - Google Sheets Sync Apps Script
 * -------------------------------------------------
 */

const SPREADSHEET_ID = '1OqSfi1H0EyEErW799yz9Ydg3WxUccKAfMibb91NbHpo';

const SHEET_HEADERS = [
  'Pending Date',
  'Days Late',
  'Center Name',
  'Member ID',
  'Member Name',
  'Week',
  'Mobile 1',
  'Mobile 2',
  'Bill Amount',
  'Collected',
  'Pending Due',
  'Status',
  'Schedule ID'
];

function getTargetSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var target = ss.getSheetByName('Pending Collections');
  if (!target) {
    target = ss.insertSheet('Pending Collections', 0);
  }
  return target;
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
    if (action === 'test_write') {
      const sheet = getTargetSheet_();
      sheet.clearContents();
      sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
      return jsonResponse_({ status: 'ok', message: 'Test write success on sheet: ' + sheet.getName() });
    }
    return jsonResponse_({ status: 'ok', message: 'Sindhuja Fin Google Sheets Sync Active v3' });
  } catch (err) {
    return jsonResponse_({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) ? e.postData.contents : '{}');
    const action = body.action;

    if (action === 'ADD_PENDING') {
      const written = handleAddPending_(body.records || []);
      return jsonResponse_({ status: 'success', action: 'ADD_PENDING', count: written });
    }

    if (action === 'REMOVE_PAID') {
      const removed = handleRemovePaid_(body);
      return jsonResponse_({ status: 'success', action: 'REMOVE_PAID', removed: removed });
    }

    return jsonResponse_({ status: 'success', action: action || 'PING' });
  } catch (err) {
    return jsonResponse_({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getBillAmt_(r) {
  return (r.baseAmount !== undefined && r.baseAmount !== null)
    ? (Number(r.baseAmount) || 0)
    : (Number(r.pendingDue) || 0);
}

function handleAddPending_(records) {
  const sheet = getTargetSheet_();

  // Filter out paid/verified/received and any row where collected >= billAmount
  const cleaned = (records || []).filter(function (r) {
    const billAmt = getBillAmt_(r);
    const collectedAmt = Number(r.collectedAmount) || 0;
    const dueAmt = billAmt - collectedAmt;
    const st = String(r.status || '').trim();
    if (st === 'Paid' || st === 'Received' || st === 'Verified') return false;
    return dueAmt > 0;
  });

  // Sort strictly Date-wise (Oldest -> Newest), then Center -> Member -> Week -> Schedule ID
  const sorted = cleaned.slice().sort(function (a, b) {
    const d1 = String(a.pendingDate || '');
    const d2 = String(b.pendingDate || '');
    if (d1 !== d2) return d1 < d2 ? -1 : 1;

    const c1 = String(a.centerName || '');
    const c2 = String(b.centerName || '');
    if (c1 !== c2) return c1.localeCompare(c2);

    const m1 = String(a.memberName || '');
    const m2 = String(b.memberName || '');
    if (m1 !== m2) return m1.localeCompare(m2);

    const w1 = Number(a.weekNumber) || 0;
    const w2 = Number(b.weekNumber) || 0;
    if (w1 !== w2) return w1 - w2;

    return (Number(a.scheduleId) || 0) - (Number(b.scheduleId) || 0);
  });

  // Clear sheet content safely
  sheet.clearContents();

  // Write Header Row
  const headerRange = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
  headerRange.setValues([SHEET_HEADERS]);
  try {
    headerRange
      .setFontWeight('bold')
      .setBackground('#1e293b')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  } catch (e) {}

  if (sorted.length === 0) return 0;

  const todayStr = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');

  const rows = sorted.map(function (r) {
    const billAmt = getBillAmt_(r);
    const collectedAmt = Number(r.collectedAmount) || 0;
    const dueAmt = Math.max(0, billAmt - collectedAmt);

    // Calculate Days Late if not provided by backend
    var daysLate = Number(r.daysLate);
    if (isNaN(daysLate) || daysLate === undefined || daysLate === null) {
      daysLate = 0;
      var pDate = String(r.pendingDate || '').trim();
      if (pDate) {
        var d1 = new Date(pDate);
        var d2 = new Date(todayStr);
        var diff = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        daysLate = Math.max(0, diff);
      }
    }

    return [
      String(r.pendingDate || ''),
      daysLate,
      String(r.centerName || ''),
      String(r.memberId || ''),
      String(r.memberName || ''),
      String(r.weekLabel || (r.weekNumber ? 'Week ' + r.weekNumber : '')),
      String(r.mobile1 || r.mobile_no || r.phone || ''),
      String(r.mobile2 || r.nominee_mobile || ''),
      billAmt,
      collectedAmt,
      dueAmt,
      String(r.status || 'Pending'),
      String(r.scheduleId || '')
    ];
  });

  const numRows = rows.length;

  // Batch write data rows
  sheet.getRange(2, 1, numRows, SHEET_HEADERS.length).setValues(rows);

  try {
    sheet.getRange(2, 1, numRows, 2).setHorizontalAlignment('center'); // Date & Days Late
    sheet.getRange(2, 6, numRows, 1).setHorizontalAlignment('center'); // Week
    sheet.getRange(2, 7, numRows, 2).setHorizontalAlignment('center'); // Mobiles
    sheet.getRange(2, 11, numRows, 1).setFontWeight('bold').setFontColor('#b91c1c'); // Pending Due
    sheet.getRange(2, 12, numRows, 2).setHorizontalAlignment('center'); // Status & Schedule ID
    for (var col = 1; col <= SHEET_HEADERS.length; col++) {
      sheet.autoResizeColumn(col);
    }
  } catch (e) {}

  return numRows;
}

function handleRemovePaid_(body) {
  const rawIds = [];
  if (Array.isArray(body.scheduleIds)) rawIds.push.apply(rawIds, body.scheduleIds);
  if (Array.isArray(body.ids)) rawIds.push.apply(rawIds, body.ids);
  if (body.scheduleId !== undefined && body.scheduleId !== null) rawIds.push(body.scheduleId);

  const idSet = {};
  rawIds.forEach(function (id) {
    const clean = String(id).trim();
    if (clean) idSet[clean] = true;
  });

  if (Object.keys(idSet).length === 0) return 0;

  const sheet = getTargetSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var idColIdx = -1;
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || '').trim().toLowerCase();
    if (h === 'schedule id' || h === 'scheduleid' || h === 'schedule_id' || h === 'id') {
      idColIdx = c;
      break;
    }
  }

  var candidateCols = idColIdx !== -1
    ? [idColIdx + 1]
    : [Math.min(12, lastCol), Math.min(8, lastCol)].filter(function (v, i, a) { return v >= 1 && a.indexOf(v) === i; });

  var removed = 0;
  var rowsToDelete = {};

  candidateCols.forEach(function (colNum) {
    var values = sheet.getRange(2, colNum, lastRow - 1, 1).getValues();
    for (var r = 0; r < values.length; r++) {
      var cellVal = String(values[r][0] || '').trim();
      if (idSet[cellVal]) {
        rowsToDelete[r + 2] = true;
      }
    }
  });

  var rowNums = Object.keys(rowsToDelete).map(Number).sort(function (a, b) { return b - a; });
  for (var k = 0; k < rowNums.length; k++) {
    sheet.deleteRow(rowNums[k]);
    removed++;
  }

  return removed;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
