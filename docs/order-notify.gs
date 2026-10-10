/**
 * BBQ NANNY 订单通知
 * 把网站上的订单写进 Google 表格，并发一封邮件到下面的信箱。
 * 部署方法见 docs/订单通知设置.md
 */

var EMAIL_TO = 'joejer8278@gmail.com';   // 收通知的信箱
var HEADERS = ['时间', '姓名', '电话', '配送方式', '地址', '烧烤日期', '备注',
               '合计 RM', '件数', '商品明细', '语言'];

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    saveRow_(d);
    sendMail_(d);
  } catch (err) {
    console.error(err);
  }
  return ContentService.createTextOutput('ok');
}

function saveRow_(d) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold').setBackground('#F26A1B').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(5, 260);
    sh.setColumnWidth(10, 420);
  }
  sh.appendRow([
    new Date(), d.name || '', d.phone || '', d.ship || '', d.addr || '',
    d.date || '', d.note || '', Number(d.total || 0), d.count || 0,
    d.items || '', d.lang === 'en' ? 'English' : '中文'
  ]);
}

function sendMail_(d) {
  var subject = '🔥 新订单 ' + (d.name || '访客') + ' · RM ' + (d.total || '0.00');
  var body =
    '顾客刚在网站上按了「发送到 WhatsApp」。\n' +
    '注意：这代表他已填好资料，但不保证他真的在 WhatsApp 按了发送。\n' +
    '若 WhatsApp 没收到消息，可以照下面的电话主动联系。\n\n' +
    '────────────────────\n' +
    (d.text || '') +
    '\n────────────────────\n' +
    '完整记录在 Google 表格：' + SpreadsheetApp.getActiveSpreadsheet().getUrl();
  MailApp.sendEmail({ to: EMAIL_TO, subject: subject, body: body, name: 'BBQ NANNY 网站' });
}

/** 部署前可先点这个函数跑一次，确认表格和邮件都正常。 */
function testNotify() {
  doPost({ postData: { contents: JSON.stringify({
    name: '测试客户', phone: '012-3456789', ship: 'Klang Valley 配送',
    addr: '57 Jalan 5/116B, Kuchai Lama, 58200 KL', date: '2026-10-18',
    note: '这是一笔测试订单，可以删除', total: '688.00', count: 1,
    items: '超值 6–8 人烧烤配套 ×1 — RM 688.00', lang: 'cn',
    text: '🔥 BBQ NANNY 订单（测试）'
  }) } });
}
