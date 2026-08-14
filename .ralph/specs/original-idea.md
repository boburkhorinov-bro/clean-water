# Mening mijozlarim uchun mahsulotlarlarim joylashtirilgan platforma-sayt yaratish kerak
# Nomi: Clean Water
# Sayt SUV filtr olmoqchi bolganlar uchun bo"lib, ular link orqali kirishadi.
# Sodda va tabiiy sayt: chap tomonda logo va «Dashboard», «Osmos suv filtrlar», «Suv filtr kartrijlari», «Servis center» va «Biz mijozlar» bo*Limlari bo"ladi. Undan pastda foydalanuvchilar uchun «Fikr mulohazalar» uchun joy, til (0'zbek), mahsulotlarini almashtirish va platformadan chiqish tugmalari bo'ladi.
# Har bir bo'limda nima bo'lishi hagida gisqacha:
# 1) Dashboard - ChiroyLi 3D banner, unda: <CLEAN WATER> ga xush klibsiz, "bu siz va oilangiz salomatligi uchun xizmat qiladigan platforma" deb yozilgan bo"ladi. Pastda filtrlar bo'yicha progress - modullar ochiladi va qanday mahsulotlarlar borligini ko'rish mumkin. Har bir modul nima uchunligini ko'rsatuvchi shkala bo"lib, u o'z-o'zidan to'ladi.
# 2) Osmos filtrlar - Moduli ochiladi, unda qanday filtrlar borligini va ulardan qaysilari o'ziga qulayligini (tanlash bilan) ko'rish mumkin bo"ladi. Pastda filtrlarlar bo'yicha alohida malumotlar bo'ladi. mijozchi modulni ochib, qaysi filtrlar borligini ko'radi va o'ziga yoqqan filtrni tanlab buyurtma beradi yoki orqaga qaytib boshqa filtr tanlaydi
# 3) Suv filtr kartrijlari - Bu bo'Limda filtrlarga kerakli  bo'lgan zamena kartrijlar qoshimcha ehtiyot qismlari haqida malumotlar boladi. ular birin ketin joylashadi va ularni vazifalari va narxlarini korish mumkin va zakaz qilish mumkin, unda filtr nomi va qachon almashtirish ko'rsatiladi.
# 4) Servis center - Har bir xizmat uchun oynachalar bo'ladi va shu oynachani bosib, mijoz aynan shu bo"Lim filtrlari yoki kartrijlari bazasiga o"tadi: (biz haqimiz), (xizmatlar), (narxlar), (arizava shikoyatlar)
# Oynachaga kirgandan so'ng jadval bo'yicha qidiruv va pastda jadval bo"ladi. Birinchi ustun - (nom), keyin - (tavsif), uchinchi - (havola).
# 5) fikr mulohazalar uchun joy - ismi, taklif shikoyatlar jadvali
# filtr  tugmasini bosganda ochilgan sahifada:
# Yugorida modul raqami va filtr modeli, . Undan keyin video - video Kinescope orgali yuklanadi. Video ostida taqdimot - HTHL formatida yuklanadigan obzor bo'Lib, unda shu filtr haqida hamma narsa yozilgan bo"ladi. Taqdimot korilgach buyurtma tugmasi  bo"ladi.
# Sayt dizayni:
# Montserrat shriftli mininalistik va zamonaviy sayt, tabiiy tugmalar bilan. Rang - och kok(osmon rang) bilan binafsha. «Tun» mavzusida - binafsha va toq kok, «Kun» mavzusida oq va binafsha.
# Sayt zavfsiz bo'Lishi kerak - hech qanday maulumotlar buzilishi, begonalar tomonidan ozgartirib bo"lmaydi,  intection va boshqa hujumlardan himoya.
# Admin panel hahida ma'Lumot:
# Adminlarda pastki chap tononda (fikr mulohazalar) yonida admin paneli tumbleri bo"ladi, Uni yoqib, admin filtrlar, malumotlar   qo'sha oladi - hanma joyda qo'shish uchun •+» tugmalari va tabiiy tugnalar bo'Lishi kerak.
# Texnik xususäyatlar bo'yicha:
# Suv filtrlari platformasi uchun asosiy texnik xususiyatlar:
# Arxitektura: Mobil versiyaga moslashuvchan (Responsive) veb-sayt va Telegram bot integratsiyasi (PWA imkoniyati bilan).
# Frontend/Dizayn: Minimalist uslub, toza ranglar va Montserrat shrifti.
# Backend va Ma'lumotlar bazasi: PostgreSQL yoki MongoDB (tezkor va xavfsiz ishlash uchun).
# Asosiy funksiyalar:
# Mahsulotlar katalogi va filtrlash tizimi. Mos filtrni tanlash uchun interaktiv viktorina (Quiz).
# bolib tolash tizimlari 
# CRM va Avtomatlashtirish: Mijozlar bazasi va har 6 oyda kartrij almashtirish vaqtini eslatuvchi avtomatik Telegram bot xabarnomalari.