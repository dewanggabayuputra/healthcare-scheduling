# Healthcare Scheduling

Aplikasi ini terdiri dari tiga service:

| Service          | Fungsi                                 | Alamat                          |
| ---------------- | -------------------------------------- | ------------------------------- |
| Auth Service     | Register, login, dan validasi token    | `http://localhost:3001/graphql` |
| Schedule Service | Mengelola customer, dokter, dan jadwal | `http://localhost:3002/graphql` |
| PostgreSQL       | Menyimpan data aplikasi                | `localhost:5433`                |
| Redis            | Cache dan antrean email BullMQ         | `localhost:6379`                |

## Menjalankan aplikasi

Pastikan Docker Desktop sudah berjalan. Dari folder utama project, buat file
`.env` jika belum ada, lalu isi `JWT_SECRET`:

```env
JWT_SECRET=ganti-dengan-secret-random-yang-panjang
```

Jangan commit file `.env` atau membagikan nilai `JWT_SECRET`.

Buat juga konfigurasi SMTP untuk Schedule Service dari template jika file
`schedule-service/.env` belum ada (agar konfigurasi SMTP yang sudah ada tidak
tertimpa):

```powershell
if (-not (Test-Path .\schedule-service\.env)) {
  Copy-Item .\schedule-service\.env.example .\schedule-service\.env
}
```

Isi `SMTP_USER`, `SMTP_PASS`, dan `SMTP_FROM` di `schedule-service/.env`
dengan kredensial SMTP yang valid. Docker Compose memuat file ini ke Schedule
Service. Jangan commit file `.env` atau membagikan nilai rahasia di dalamnya.

Jalankan database dan kedua service:

```sh
docker compose up --build -d
```

Periksa status container:

```sh
docker compose ps
```

Migration database dijalankan otomatis saat service mulai. Untuk menghentikan
container tanpa menghapus data database:

```sh
docker compose down
```

## Notifikasi email dan BullMQ

Schedule Service menggunakan BullMQ untuk mengirim email secara asynchronous.
Saat jadwal dibuat, email konfirmasi dikirim ke alamat customer; saat jadwal
dihapus, email pembatalan dikirim. Worker `EmailProcessor` memproses antrean
`notifications` di dalam Schedule Service, sedangkan Redis dari Docker Compose
menyimpan antreannya. Tidak diperlukan service worker atau mail server
tambahan di Docker.

Atur konfigurasi berikut di `schedule-service/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alamat-email-anda@gmail.com
SMTP_PASS=google-app-password
SMTP_FROM="Healthcare Scheduling <alamat-email-anda@gmail.com>"
```

Untuk Gmail, aktifkan verifikasi dua langkah lalu buat **App Password** dan
gunakan nilainya sebagai `SMTP_PASS` (bukan password login Gmail). Jika memakai
provider SMTP lain, sesuaikan `SMTP_HOST`, `SMTP_PORT`, kredensial, dan alamat
pengirim dengan pengaturan provider tersebut. Jangan commit atau membagikan
kredensial SMTP. Setelah mengubah file environment, terapkan konfigurasi dengan:

```sh
docker compose up -d --force-recreate schedule-service
```

Job email dicoba hingga tiga kali dengan exponential backoff mulai dari 5
detik. Untuk memeriksa worker atau masalah SMTP:

```sh
docker compose logs -f schedule-service redis
```

Email diproses setelah mutation jadwal berhasil; respons GraphQL tidak menunggu
pengiriman email selesai. Jika Redis tidak tersedia atau job gagal dimasukkan
ke antrean, periksa log Schedule Service.

## Unit test

Unit test dijalankan di dalam container Docker dengan target `test` pada
Dockerfile masing-masing service. Test memakai mock untuk database dan
dependensi eksternal, jadi tidak membutuhkan database container yang sedang
berjalan. Schedule Service menjalankan Jest dengan coverage dan mensyaratkan
minimal 50% untuk statements, branches, functions, dan lines. Laporan coverage
tersedia di folder `schedule-service/coverage`. Dari folder utama project,
build dan jalankan test Auth Service:

```powershell
docker build --target test -t healthcare-auth-test ./auth-service
docker run --rm healthcare-auth-test
```

Build dan jalankan test Schedule Service:

```sh
docker build --target test -t healthcare-schedule-test ./schedule-service
docker run --rm healthcare-schedule-test
```

Perintah `docker run` mengembalikan exit code Jest, sehingga kegagalan test
juga akan membuat perintah gagal. Target runtime biasa tetap menggunakan stage
`runner`; target `test` hanya untuk menjalankan unit test.

## Menggunakan Postman

API juga bisa dicoba melalui Postman dengan mengimpor file yang tersedia di
folder utama project:

- [postman-collection.json](./postman-collection.json): kumpulan request
  GraphQL untuk Auth Service dan Schedule Service.
- [postman-environment.json](./postman-environment.json): environment lokal
  dengan URL service dan variabel token serta ID.

Di Postman, pilih **Import**, lalu **Files**, dan pilih kedua file tersebut.
Setelah import, pilih environment **Healthcare Scheduling - Local Docker**.
Jalankan request **Register**, lalu **Login**; token login akan disimpan
otomatis pada variabel `accessToken`. Selanjutnya jalankan **Create Customer**
dan **Create Doctor**, lalu salin ID dari hasil masing-masing request ke
variabel `customerId` dan `doctorId` di environment sebelum menjalankan
**Create Schedule**.

## Menggunakan GraphQL Playground

Kedua service menyediakan GraphQL IDE melalui Apollo Sandbox saat service
berjalan. Buka salah satu alamat berikut di browser:

- Auth Service: <http://localhost:3001/graphql>
- Schedule Service: <http://localhost:3002/graphql>

Di editor, tulis operasi GraphQL pada panel operasi, isi input pada panel
**Variables** menggunakan JSON, lalu jalankan operasi dengan tombol **Run**.
Gunakan **Docs** atau **Schema** di IDE untuk melihat tipe dan field yang
tersedia.

Alur penggunaannya:

1. Register lalu login melalui Auth Service.
2. Salin `accessToken` dari hasil login.
3. Sebelum menjalankan operasi Schedule Service, tambahkan request header
   `Authorization` dengan nilai `Bearer <accessToken>` pada pengaturan Headers
   di Sandbox. Ganti `<accessToken>` dengan token hasil login.
4. Jalankan operasi Schedule Service. Buat customer dan dokter terlebih dahulu
   untuk memperoleh ID yang dibutuhkan saat membuat jadwal.

### Register akun

Pilih endpoint Auth Service. Jalankan operasi berikut:

```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    id
    email
    createdAt
  }
}
```

Masukkan pada panel **Variables**:

```json
{
  "input": {
    "email": "demo@example.com",
    "password": "password123"
  }
}
```

Email harus belum pernah terdaftar. Jika sudah pernah digunakan, register
dengan email lain atau lanjutkan dengan login.

### Login dan mendapatkan token

Tetap di endpoint Auth Service, jalankan:

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    accessToken
    user {
      id
      email
    }
  }
}
```

Variables:

```json
{
  "input": {
    "email": "demo@example.com",
    "password": "password123"
  }
}
```

Salin nilai `data.login.accessToken` dari hasilnya. Token tersebut digunakan
untuk mengakses Schedule Service. Jangan membagikan token kepada orang lain.

### Membuat customer dan dokter

Buka endpoint Schedule Service dan tambahkan header autentikasi seperti
dijelaskan di atas. Buat customer:

```graphql
mutation CreateCustomer($input: CreateCustomerInput!) {
  createCustomer(input: $input) {
    id
    name
    email
  }
}
```

Variables:

```json
{
  "input": {
    "name": "Pasien Contoh",
    "email": "pasien@example.com"
  }
}
```

Simpan `id` dari hasil operasi. Buat dokter dengan operasi berikut:

```graphql
mutation CreateDoctor($input: CreateDoctorInput!) {
  createDoctor(input: $input) {
    id
    name
  }
}
```

Variables:

```json
{
  "input": {
    "name": "Dr. Contoh"
  }
}
```

Simpan juga `id` dokter dari hasilnya.

### Membuat jadwal

Gunakan ID customer dan dokter yang diperoleh sebelumnya:

```graphql
mutation CreateSchedule($input: CreateScheduleInput!) {
  createSchedule(input: $input) {
    id
    objective
    customerId
    doctorId
    scheduledAt
  }
}
```

Variables:

```json
{
  "input": {
    "customerId": "ID_CUSTOMER",
    "doctorId": "ID_DOKTER",
    "objective": "Konsultasi",
    "scheduledAt": "2030-01-15T09:00:00.000Z"
  }
}
```

Ganti `ID_CUSTOMER` dan `ID_DOKTER` dengan ID asli. `scheduledAt` harus
menggunakan format tanggal-waktu ISO 8601. Satu dokter tidak dapat memiliki
dua jadwal pada waktu yang sama.

### Membaca data

Query daftar customer dan dokter menerima nomor halaman dan jumlah data per
halaman. `page` dimulai dari 1 dan `limit` maksimum 100.

```graphql
query GetCustomers {
  customers(page: 1, limit: 10) {
    items {
      id
      name
      email
    }
    total
    page
    limit
    totalPages
  }
}
```

```graphql
query GetDoctors {
  doctors(page: 1, limit: 10) {
    items {
      id
      name
    }
    total
    page
    limit
    totalPages
  }
}
```

Untuk mencari jadwal, query ini mendukung filter customer, dokter, dan rentang
waktu. Semua field filter bersifat opsional:

```graphql
query GetSchedules {
  schedules(
    page: 1
    limit: 10
    filter: {
      doctorId: "ID_DOKTER"
      fromDate: "2026-12-01T00:00:00.000Z"
      toDate: "2026-12-31T23:59:59.999Z"
    }
  ) {
    items {
      id
      objective
      customerId
      doctorId
      scheduledAt
    }
    total
    page
    limit
    totalPages
  }
}
```

Untuk mengambil satu data, gunakan `customer(id: "...")`, `doctor(id: "...")`,
atau `schedule(id: "...")` pada query Schedule Service.

### Mengubah dan menghapus data

Field pada input update bersifat opsional. Contoh mengubah nama customer:

```graphql
mutation UpdateCustomer {
  updateCustomer(
    id: "ID_CUSTOMER"
    input: { name: "Nama Pasien Baru" }
  ) {
    id
    name
    email
  }
}
```

Operasi update lain yang tersedia adalah `updateDoctor(id, input)`. Untuk
menghapus data, gunakan `deleteCustomer(id)`, `deleteDoctor(id)`, atau
`deleteSchedule(id)`. Ketiga operasi delete mengembalikan objek yang dihapus
dan dapat dipilih field-nya, misalnya:

```graphql
mutation DeleteCustomer($id: String!) {
  deleteCustomer(id: $id) {
    id
    name
    email
  }
}
```

```graphql
mutation DeleteDoctor($id: String!) {
  deleteDoctor(id: $id) {
    id
    name
  }
}
```

Untuk schedule, argumen ID bertipe GraphQL `ID!`:

```graphql
mutation DeleteSchedule($id: ID!) {
  deleteSchedule(id: $id) {
    id
    objective
  }
}
```

Customer atau dokter yang masih memiliki jadwal tidak dapat dihapus. Hapus
jadwal terkait terlebih dahulu; penghapusan jadwal juga memasukkan email
pembatalan ke antrean BullMQ.

Daftar operasi lengkap untuk disalin ke Apollo Sandbox tersedia di
[apollo-operations.graphql](./apollo-operations.graphql).

## Jika ada masalah

- **Endpoint tidak dapat dibuka:** pastikan container berjalan dengan
  `docker compose ps`.
- **Unauthorized pada Schedule Service:** pastikan header `Authorization`
  memakai skema `Bearer` dan access token masih valid.
- **Service gagal mulai:** periksa log dengan `docker compose logs -f
  auth-service schedule-service` dan pastikan `JWT_SECRET` sudah diisi di
  `.env`.
- **Port sudah digunakan:** pastikan port `3001`, `3002`, dan `5433` tersedia.
