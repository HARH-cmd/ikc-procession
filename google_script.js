/**
 * كود Google Apps Script لاستقبال طلبات التسجيل من الاستمارة وحفظها في Google Sheets (نسخة محدثة تشمل سنة الميلاد).
 * 
 * طريقة الإعداد والتحديث:
 * 1. افتح جدول بيانات Google الخاص بك.
 * 2. اختر Extensions -> Apps Script.
 * 3. استبدل الكود القديم بهذا الكود المحدث بالكامل.
 * 4. اضغط حفظ (Ctrl+S).
 * 5. اضغط على Deploy -> Manage deployments.
 * 6. اضغط على أيقونة القلم (تعديل) ثم اختر Version: New version (نسخة جديدة) واضغط Deploy.
 * 
 * تنبيه: إذا كنت قد سجلت بيانات سابقة في الجدول، يرجى إدراج عمود جديد يسمى "سنة الميلاد" 
 * يدوياً في جدول البيانات بعد عمود "المرحلة الدراسية" وقبل عمود "رقم الهاتف" لتفادي تداخل الأعمدة.
 */

function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000); // الانتظار لـ 30 ثانية لتفادي التداخل
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // إعداد الصف الأول (العناوين) إذا كانت الصفحة فارغة
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "الطابع الزمني", 
        "الاسم الكامل", 
        "الصفة", 
        "القسم العلمي", 
        "المرحلة الدراسية", 
        "سنة الميلاد",
        "رقم الهاتف", 
        "ملاحظات", 
        "قائمة الاحتياط"
      ]);
      // تنسيق الصف الأول (9 أعمدة)
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#d4af37").setFontColor("#000000");
    }
    
    var params = e.parameter;
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }
    
    var name = params.name;
    var role = params.role;
    var department = params.department;
    var stage = params.stage || "—";
    var birthYear = params.birthYear || "—";
    var phone = params.phone;
    var notes = params.notes || "—";
    
    if (!name || !role || !department || !phone) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "جميع الحقول الأساسية مطلوبة"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // حساب عدد الطلاب المسجلين حالياً (باستثناء قائمة الاحتياط)
    var isWaitingList = "لا";
    if (role === "طالب") {
      var data = sheet.getDataRange().getValues();
      var activeStudentCount = 0;
      
      for (var i = 1; i < data.length; i++) {
        var rowRole = data[i][2]; // العمود C (الصفة)
        var rowWaiting = data[i][8]; // العمود I (الاحتياط)
        if (rowRole === "طالب" && (rowWaiting === "لا" || !rowWaiting)) {
          activeStudentCount++;
        }
      }
      
      // إذا تجاوز العدد 100 طالب، يتم تحويله للاحتياط
      if (activeStudentCount >= 100) {
        isWaitingList = "نعم";
      }
    }
    
    var timestamp = new Date();
    sheet.appendRow([
      timestamp, 
      name, 
      role, 
      department, 
      stage, 
      birthYear,
      "'" + phone, 
      notes, 
      isWaitingList
    ]);
    
    lock.releaseLock();
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "waitingList": isWaitingList === "نعم"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    // حساب عدد الطلاب المقبولين حالياً (باستثناء قائمة الاحتياط)
    var activeStudentCount = 0;
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        var rowRole = data[i][2]; // العمود C (الصفة)
        var rowWaiting = data[i][8]; // العمود I (الاحتياط)
        if (rowRole === "طالب" && (rowWaiting === "لا" || !rowWaiting)) {
          activeStudentCount++;
        }
      }
    }
    
    // إذا كان الطلب فقط لمعرفة العدد الإجمالي للمقاعد (عام ومتاح للجميع بدون كلمة مرور)
    if (e.parameter.action === "count") {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "success",
        "count": activeStudentCount
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // التحقق من كلمة المرور لتأمين البيانات الكاملة
    var password = e.parameter.password;
    if (password !== "IKU@2026n") {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "غير مصرح بالوصول: كلمة المرور خاطئة أو غائبة"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var registrations = [];
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        registrations.push({
          id: i,
          timestamp: data[i][0],
          name: data[i][1],
          role: data[i][2],
          department: data[i][3],
          stage: data[i][4],
          birthYear: data[i][5],
          phone: data[i][6],
          notes: data[i][7],
          waitingList: data[i][8]
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "data": registrations
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
