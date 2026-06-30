-- ARC 居留證控管系統初始資料

insert into agencies (code, short_name, full_name, contact_name, phone, display_order)
values
  ('FW','灃康','灃康人力資源股份有限公司','', '03-3577001', 10),
  ('WC','乾坤','乾坤國際股份有限公司','', '', 20),
  ('FC','灃禾','灃禾管理顧問股份有限公司','', '', 30)
on conflict (code) do update set
  short_name=excluded.short_name,
  full_name=excluded.full_name,
  phone=excluded.phone,
  display_order=excluded.display_order,
  updated_at=now();

insert into agency_accounts (agency_id, bank_code, bank_name, account_number, account_label, balance, display_order)
select id, '808', '玉山銀行', '0613440008187', '灃康｜玉山 808', 0, 10 from agencies where code='FW'
on conflict (account_number) do update set bank_code=excluded.bank_code, bank_name=excluded.bank_name, account_label=excluded.account_label, agency_id=excluded.agency_id;

insert into agency_accounts (agency_id, bank_code, bank_name, account_number, account_label, balance, display_order)
select id, '822', '中國信託', '510540554742', '灃康｜中信 822', 0, 11 from agencies where code='FW'
on conflict (account_number) do update set bank_code=excluded.bank_code, bank_name=excluded.bank_name, account_label=excluded.account_label, agency_id=excluded.agency_id;

insert into agency_accounts (agency_id, bank_code, bank_name, account_number, account_label, balance, display_order)
select id, '812', '台新銀行', '20780100008244', '乾坤｜台新 812', 0, 20 from agencies where code='WC'
on conflict (account_number) do update set bank_code=excluded.bank_code, bank_name=excluded.bank_name, account_label=excluded.account_label, agency_id=excluded.agency_id;

insert into agency_accounts (agency_id, bank_code, bank_name, account_number, account_label, balance, display_order)
select id, '812', '台新銀行', '20060100008723', '灃禾｜台新 812', 0, 30 from agencies where code='FC'
on conflict (account_number) do update set bank_code=excluded.bank_code, bank_name=excluded.bank_name, account_label=excluded.account_label, agency_id=excluded.agency_id;

insert into handlers (name, short_code, display_order) values
  ('嘉陽','',10),('佩珊','',20),('詩涵','',30),('奕君','',40),('晏婷','',50),('莞莞','',60),('若儀','',70)
on conflict (name) do update set display_order=excluded.display_order, is_active=true, updated_at=now();

insert into application_items (name, default_amount, requires_payment, requires_pickup, download_after_payment, display_order) values
  ('展延居留證',1000,true,true,false,10),
  ('變更居留地址',500,true,true,false,20),
  ('補發居留證',500,true,true,false,30),
  ('換發居留證',500,true,true,false,40),
  ('初辦居留證',1000,true,false,true,50),
  ('初辦居留證(紙本)',1000,true,false,true,60),
  ('報備不製證',0,true,false,true,70)
on conflict (name) do update set
  default_amount=excluded.default_amount,
  requires_payment=excluded.requires_payment,
  requires_pickup=excluded.requires_pickup,
  download_after_payment=excluded.download_after_payment,
  display_order=excluded.display_order,
  is_active=true,
  updated_at=now();

insert into system_settings (key, value, note) values
  ('admin_unlock_code','2468','管理員解除碼，正式使用前請修改'),
  ('default_fee','7','每批繳費預設手續費'),
  ('taoyuan_station_phone','03-331-0409(總機)','桃園市服務站電話'),
  ('taoyuan_station_fax','03-331-4811','桃園市服務站傳真'),
  ('fax_agency_name','灃康人力資源股份有限公司','傳真表下方仲介公司名稱'),
  ('fax_contact_name','','傳真表下方聯絡人'),
  ('fax_contact_phone','03-3577001','傳真表下方聯絡電話'),
  ('system_title','ARC 居留證控管系統','系統名稱')
on conflict (key) do update set value=excluded.value, note=excluded.note, updated_at=now();

insert into contacts (contact_type, name, address, phone, fax, display_order) values
('service_station','臺北市服務站','100213臺北市中正區廣州街15號','02-2388-5185(總機)','02-2331-0594',10),
('service_station','新北市服務站','235016新北市中和區民安街135號1樓','02-8228-2090(總機)','02-8228-2687',20),
('service_station','基隆市服務站','202201基隆市義一路18號11樓(A棟)','02-2427-6374(總機)','02-2428-5251',30),
('service_station','桃園市服務站','330026桃園市桃園區縣府路106號1樓','03-331-0409(總機)','03-331-4811',40),
('service_station','新竹市服務站','300003新竹市北區中華路三段12號1樓','03-524-3517(總機)','03-524-5109',50),
('service_station','新竹縣服務站','302008新竹縣竹北市三民路133號1樓','03-551-9905(總機)','03-551-9452',60),
('service_station','苗栗縣服務站','360012苗栗市中正路1291巷8號','037-322-350(總機)','037-321-093',70),
('service_station','臺中市第一服務站','408024臺中市南屯區文心南三路22號1樓','04-2472-5103(總機)','04-2472-5017',80),
('service_station','臺中市第二服務站','420010臺中市豐原區中山路280號','04-2526-9777(總機)','04-2526-8551',90),
('service_station','彰化縣服務站','500035彰化市中山路三段2號1樓','04-727-0001(總機)','04-727-0702',100),
('service_station','南投縣服務站','540018南投縣南投市文昌街87號1樓','049-220-0065(總機)','049-224-7874',110),
('service_station','雲林縣服務站','640004雲林縣斗六市府前街38號1樓','05-534-5971(總機)','05-534-6142',120),
('service_station','嘉義市服務站','600016嘉義市東區吳鳳北路184號2樓','05-216-6100(總機)','05-216-6106',130),
('service_station','嘉義縣服務站','613016嘉義縣朴子市祥和二路西段6號1樓','05-362-3763(總機)','05-362-1731',140),
('service_station','臺南市第一服務站','700016臺南市中西區府前路一段262號','06-293-7641(總機)','06-293-5775',150),
('service_station','臺南市第二服務站','741002臺南市善化區中山路353號1樓','06-581-7404(總機)','06-581-8924',160),
('service_station','高雄市第一服務站','802304高雄市苓雅區政南街6號5、6樓','07-715-1660(總機)','07-715-1306',170),
('service_station','高雄市第二服務站','820009高雄市岡山區岡山路115號','07-621-2143(總機)','07-623-6334',180),
('service_station','屏東縣服務站','900007屏東市中山路60號1樓','08-766-1885(總機)','08-766-2778',190),
('service_station','宜蘭縣服務站','260009宜蘭市民權路一段53號','03-957-5448(總機)','03-957-4949',200),
('service_station','花蓮縣服務站','970009花蓮縣花蓮市中山路371號5樓','03-8329-700(總機)','03-8339-100',210),
('service_station','臺東縣服務站','950014臺東縣臺東市長沙街59號','089-361-631(總機)','089-347-103',220),
('service_station','金門縣服務站','893017金門縣金城鎮西海路一段5號2樓','082-323-695(總機)','082-323-641',230),
('service_station','連江縣服務站','209002連江縣南竿鄉福沃村135-6號2樓','0836-23736(總機)','0836-23740',240),
('service_station','澎湖縣服務站','880006澎湖縣馬公市新生路177號1樓','06-926-4545(總機)','06-926-9469',250),
('brigade','臺北市專勤隊','116080臺北市文山區興隆路三段306號','02-2239-6393(總機)','02-2239-6396',10),
('brigade','新北市專勤隊','235016新北市中和區民安街135號2樓','02-8221-5701(總機)','02-8226-7760',20),
('brigade','基隆市專勤隊','201013基隆市信義區義七路9巷2號','02-2428-7172(總機)','02-2428-4718',30),
('brigade','桃園市專勤隊','338027桃園市蘆竹區龍安街二段968號3樓','03-217-4577(總機)','03-217-2935',40),
('brigade','新竹市專勤隊','300079新竹市崧嶺路122號','03-525-4336(總機)','03-525-8542',50),
('brigade','新竹縣專勤隊','300079新竹市北區崧嶺路122號','03-525-1343(總機)','03-527-8342',60),
('brigade','苗栗縣專勤隊','360012苗栗縣苗栗市中正路1297巷5號','037-379-045(總機)','037-379-052',70),
('brigade','臺中市專勤隊','408024臺中市南屯區文心南三路22號3樓','04-2472-5102(總機)','04-2472-5045',80),
('brigade','彰化縣專勤隊','500035彰化縣彰化市中山路三段2號2樓','04-727-0109(總機)','04-727-0103',90),
('brigade','南投縣專勤隊','540018南投縣南投市文昌街87號2、3樓','049-224-0146(總機)','049-224-6841',100),
('brigade','雲林縣專勤隊','640004雲林縣斗六市府前街38號2樓','05-534-6119(總機)','05-534-6143',110),
('brigade','嘉義市專勤隊','600016嘉義市東區林森西路172號','05-231-3609(總機)','05-231-3705',120),
('brigade','嘉義縣專勤隊','613016嘉義縣朴子市祥和二路西段6號2樓','05-362-5162(總機)','05-362-1441',130),
('brigade','臺南市專勤隊','741002臺南市善化區中山路353號2樓','06-581-3019(總機)','06-581-6328',140),
('brigade','高雄市專勤隊','800221高雄市新興區六合一路113號1樓','07-236-7524(總機)','07-236-0446',150),
('brigade','屏東縣專勤隊','900007屏東縣屏東市中山路60號2樓','08-766-2250(總機)','08-766-1882',160),
('brigade','宜蘭縣專勤隊','269024宜蘭縣冬山鄉梅花路255巷22弄35號','03-9615700(總機)','03-9615066',170),
('brigade','花蓮縣專勤隊','970024花蓮縣花蓮市港口路35號','03-822-3363(總機)','03-822-3477',180),
('brigade','臺東縣專勤隊','950014臺東縣臺東市長沙街59號2樓','089-342-095(總機)','089-342-874',190),
('brigade','金門縣專勤隊','891002金門縣金湖鎮蓮庵里5鄰西村46-3號','082-333-531(總機)','082-333-443',200),
('brigade','連江縣專勤隊','209002連江縣南竿鄉福沃村135-6號2樓','0836-23736(總機)','無',210),
('brigade','澎湖縣專勤隊','880006澎湖縣馬公市新生路177號2樓','06-926-3556(總機)','06-926-1850',220)
on conflict (contact_type, name) do update set
  address=excluded.address,
  phone=excluded.phone,
  fax=excluded.fax,
  display_order=excluded.display_order,
  is_active=true,
  updated_at=now();
