# MONSNODE Bot

Bot untuk download, search, dan list dengan Node.js

## Fitur

- 🔍 **Search** - Mencari konten
- 📥 **Download** - Download file/media
- 📋 **List** - Menampilkan daftar item
- 📡 **Broadcast** - Kirim pesan broadcast

## Instalasi

1. Clone repository ini
```bash
git clone <repository-url>
cd MONSNODE
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables
```bash
copy .env.example .env
```
Edit file `.env` dan isi dengan konfigurasi Anda

4. Jalankan bot
```bash
npm start
```

## Development

Jalankan dalam mode development dengan auto-reload:
```bash
npm run dev
```

## Struktur Projek

```
MONSNODE/
├── main.js              # Entry point aplikasi
├── db.js                # Database handler
├── broadcast.js         # Broadcast handler
├── handle/
│   ├── download.js      # Download handler
│   ├── list.js          # List handler
│   └── search.js        # Search handler
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Command/Perintah

- `/search <query>` - Mencari konten
- `/download <url>` - Download file
- `/list` - Tampilkan daftar
- `/broadcast <message>` - Kirim broadcast (admin only)

## Dependencies

- `dotenv` - Environment variables management
- `axios` - HTTP client

## License

ISC
