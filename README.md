# 🏆 කොඩි සහ ලාංඡන විනිශ්චය පද්ධතිය (Flag & Emblem Judging System)

විසිදෙනෙකුගෙන් (20) සමන්විත විනිශ්චය මණ්ඩලයක් සඳහා ජංගම දුරකථන ආශ්‍රිතව 1 සිට 10 දක්වා ලකුණු ලබාදීමේ සජීවී Cloud වෙබ් පද්ධතිය (Real-time Cloud Judging System).

---

## 🌟 පද්ධතියේ ප්‍රධාන අංග (System Components)

| අංගය (Component) | Path | විස්තරය (Description) |
| :--- | :--- | :--- |
| 📱 **Judge Mobile Portal** | `/judge.html` | විනිශ්චයකරුවන් 20 දෙනාට 1–10 ලකුණු ලබාදීමේ තිරය |
| ⚙️ **Admin Dashboard** | `/admin.html` | තරඟ මෙහෙයවීම, 20 දෙනාගේ සජීවී ප්‍රගතිය, Excel Export |
| 📺 **Projector Display** | `/display.html` | ශාලාවේ තිරයට සජීවී නිර්මාණය සහ ජයග්‍රාහී Podium පුවරුව |
| 🖨️ **Printable QR Cards** | `/qr-sheet.html` | විනිශ්චයකරුවන් 20 දෙනාගේ මේස මත තබන QR කාඩ්පත් මුද්‍රණය |
| 🏠 **Home Page** | `/index.html` | සියලුම පිටු වලට පිවිසීමේ ප්‍රධාන ද්වාරය |

---

## 🚀 පරිගණකයේ පරීක්ෂා කිරීම (Local Run)

1. මෙම ෆෝල්ඩරයේ Terminal / PowerShell එකක් විවෘත කරන්න.
2. සේවාදායකය ආරම්භ කරන්න:
   ```bash
   npm start
   ```
3. බ්‍රවුසරයෙන් පිවිසෙන්න:
   * **Home:** [http://localhost:3000](http://localhost:3000)
   * **Judge 01 (Auto-login test):** [http://localhost:3000/judge.html?judge=1&pin=1001](http://localhost:3000/judge.html?judge=1&pin=1001)
   * **Admin Panel:** [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## ☁️ Render.com හි නොමිලේ Host කරන ආකාරය (Deploy to Render)

Render.com වෙත මෙම පද්ධතිය නොමිලේ විනාඩි 2කින් Upload කරගන්න:

### පියවර 1: GitHub වෙත Code එක Upload කරන්න
1. ඔබගේ [GitHub.com](https://github.com) ගිණුමට ගොස් **New Repository** එකක් සාදන්න (උදා: `judge-system`).
2. මෙම Folder එකේ Terminal එකේ පහත විධානයන් ධාවනය කරන්න:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/judge-system.git
   git branch -M main
   git push -u origin main
   ```

### පියවර 2: Render.com හි Web Service එකක් සාදන්න
1. [Render.com](https://render.com) වෙත ගොස් නොමිලේ ගිණුමක් (Sign up) සාදන්න හෝ Log in වන්න.
2. **Dashboard** එකෙහි **New +** ක්ලික් කර **Web Service** තෝරන්න.
3. ඔබගේ GitHub ගිණුම සම්බන්ධ කර ඉහත සාදන ලද `judge-system` repository එක තෝරා **Connect** කරන්න.
4. පහත සැකසුම් (Settings) තහවුරු කරන්න:
   * **Name:** `judge-system` (හෝ ඔබ කැමති නමක්)
   * **Region:** Singapore හෝ Frankfurt (ශ්‍රී ලංකාවට ආසන්නතම)
   * **Runtime:** `Node`
   * **Build Command:** `npm install`
   * **Start Command:** `node server.js`
   * **Plan Type:** `Free`
5. පිටුවේ පහළ ඇති **Deploy Web Service** බොත්තම ක්ලික් කරන්න.

### පියවර 3: සජීවී Link එක ලබාගැනීම
* මිනිත්තු 1-2 කින් Render මඟින් ඔබට නොමිලේ සජීවී වෙබ් ලිපිනයක් ලබාදෙනු ඇත:
  `https://judge-system-xxxx.onrender.com`
* දැන් විනිශ්චයකරුවන්ගේ QR Code sheet එකට ගොස් Print කරගත හැක!

---

## 🔑 විනිශ්චයකරුවන් 20 දෙනාගේ PIN අංක (Default Credentials)

| Judge # | Name | PIN | Direct Login URL Example |
| :--- | :--- | :--- | :--- |
| 1 | Judge 01 | `1001` | `/judge.html?judge=1&pin=1001` |
| 2 | Judge 02 | `1002` | `/judge.html?judge=2&pin=1002` |
| 3 | Judge 03 | `1003` | `/judge.html?judge=3&pin=1003` |
| ... | ... | ... | ... |
| 20 | Judge 20 | `1020` | `/judge.html?judge=20&pin=1020` |

*QR Sheet එකේ ඇති QR Code එක Scan කළ විට ඉහත PIN අංකයද සහිතව එක ක්ලික් එකෙන් දුරකථනයෙන්ම Log in වේ.*
