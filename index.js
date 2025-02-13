const express = require("express");
const app = express();
const port = 3000;
const bodyParser = require("body-parser");
const session = require('express-session');
app.set("view engine", "ejs");
app.set("views", "./views")

app.listen(port, () =>{
  console.log(`Ung dung dang chay voi port ${port}`);
});

const { Client } = require('pg');
var pg = new Client({
  user: 'postgres',
  password: 'admin',
  host: 'localhost',
  port: '5432',
  database: 'BTL',
});

pg.connect()
    .then(() => console.log("Connected to PostgreSQL database"))
    .catch(err => console.error("Lỗi kết nối đến PostgreSQL", err));

// cấu hình body-parser để lấy dữ liệu từ form
app.use(bodyParser.urlencoded({ extended: true }));
// đặt thư mục tĩnh cho express
app.use(express.static('anh'));
// dùng seission
app.use(session({
  secret: 'sieu_bi_mat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // dùng HTTPS đặt là true
}));

//--------------------

// hiện trang đăng kí
app.get("/register", (reg, res)=> {
  res.render("register")
})
// xử lí trang đăng kí
app.post("/register", async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  // check mật khẩu khớp chưa
  if (password !== confirmPassword) {
      return res.send(`<div><h1>Mật khẩu không khớp <a href="/register">Quay lại</a></h1></div>`);
  }

  try {
      // xem tên đăng nhập đã có trong csdl chưa
      const userCheck = await pg.query("SELECT * FROM nguoi_dung WHERE tai_khoan = $1", [username]);
      if (userCheck.rows.length > 0) {
          return res.send(`<div><h1>Tên đăng nhập tồn tại <a href="/register">Quay lại</a></h1></div>`);
      }

      await pg.query("INSERT INTO nguoi_dung (tai_khoan, mat_khau) VALUES ($1, $2)", [username, password]);

      res.redirect("/login");
  } catch (error) {
      console.error("Lỗi khi xử lý đăng ký:", error);
      res.send(`<div><h1>Có lỗi gì đó xảy ra <a href="/register">Quay lại</a></h1></div>`);
  }
});

//--------------------

// hiện trang đăng nhập
app.get("/login", (reg, res)=> {
  res.render("login")
})
// xử lí trang đăng nhập
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // nếu điền tài khoản admin
  if (username === "admin" && password === "admin") {
      return res.redirect("/quanli");
  }

  try {
      // kiểm tra thông tin trong cơ sở dữ liệu
      const result = await pg.query("SELECT * FROM nguoi_dung WHERE tai_khoan = $1 AND mat_khau = $2", [username, password]);

      if (result.rows.length > 0) {
        const user = result.rows[0]; // lấy thông tin người dùng
        // lưu userId vào session
        req.session.userid = user.id_user;

        res.redirect("/trangchu");
      } else {
          // báo lỗi nếu không thấy
          res.send(`<div><h1>Sai tài khoản hoặc mật khẩu <a href="/login">Quay lại</a></h1></div>`);
      }
  } catch (error) {
      console.error("Lỗi khi xử lý đăng nhập:", error);
      res.send(`<div><h1>Có lỗi gì đó xảy ra <a href="/login">Quay lại</a></h1></div>`);
  }
});

//--------------------

// hiện trang chủ
app.get("/trangchu", (req, res)=> {
  const logged = !!req.session.userid; // kiểm tra session
  res.render("trangchu", { logged })
})

//--------------------

// hiện trang quản lí
// truy vấn db
async function fetchData(tableName) {
  try {
    const query = `SELECT * FROM "${tableName}"`;
    const result = await pg.query(query);
    return result.rows;
  } catch (error) {
    console.error(`Lỗi khi truy vấn bảng ${tableName}:`, error);
    return { error: `Lỗi khi truy vấn bảng ${tableName}` };
  }
}
// hiện dữ liệu chung 1 trang
app.get('/quanli', async (req, res) => {
  try {
    const users = await fetchData('nguoi_dung');
    const info = await fetchData('bao_tang');
    const cmts = await fetchData('danh_gia');

    res.render('quanli', { users, info, cmts });
  } catch (error) {
    console.error('Lỗi chung:', error);
    res.status(500).send('<div><h1>Có lỗi hệ thống. Vui lòng thử lại sau.</h1></div>');
  }
});

//--------------------

// xóa người dùng
app.post('/delete-user', async (req, res) => {
  const userId = req.body.userId;

  try {
      const deleteQuery = "DELETE FROM nguoi_dung WHERE id_user = $1";
      await pg.query(deleteQuery, [userId]);
      res.redirect('/quanli');
  } catch (error) {
      console.error('Lỗi khi xóa người dùng:', error);
      res.status(500).send(`<div><h1>Lỗi khi xóa người dùng<a href="/quanli">Quay lại</a></h1></div>`);
  }
});

//--------------------

// xóa dữ liệu địa điểm
app.post('/delete-diadiem', async (req, res) => {
  const inforId = req.body.inforId;

  try {
      const deleteQuery = "DELETE FROM bao_tang WHERE id = $1";
      await pg.query(deleteQuery, [inforId]);
      res.redirect('/quanli');
  } catch (error) {
      console.error('Lỗi khi xóa:', error);
      res.status(500).send(`<div><h1>Lỗi khi xóa dữ liệu<a href="/quanli">Quay lại</a></h1></div>`);
  }
});

//--------------------

// sửa dữ liệu địa điểm
// lấy thông tin từ database theo id
app.get('/edit-diadiem/:id', async (req, res) => {
  const editId = req.params.id;

  try {
      const result = await pg.query('SELECT * FROM bao_tang WHERE id = $1', [editId]);
      if (result.rows.length > 0) {
          res.render('edit-diadiem', { muse: result.rows[0] });
      } else {
          res.status(404).send("<div><h1>Không tìm thấy dữ liệu bảo tàng</h1><a href='/quanli'>Quay lại</a></div>");
      }
  } catch (error) {
      console.error('Lỗi khi truy vấn dữ liệu:', error);
      res.status(500).send("<div><h1>Lỗi khi lấy dữ liệu</h1><a href='/quanli'>Quay lại</a></div>");
  }
});
// cập nhật dữ liệu
app.post('/edit-diadiem/:id', async (req, res) => {
  const id = req.params.id; // nhận id từ URL
  const { name, diachi, kinda, x, y, open, money, pic } = req.body;

  try {
      await pg.query(
          `UPDATE bao_tang 
           SET ten = $1, dia_chi = $2, phan_loai = $3, toa_do_x = $4, toa_do_y = $5, thoi_gian_mo_cua = $6, gia_ve = $7, anh = $8 
           WHERE id = $9`,
          [name, diachi, kinda, x, y, open, money, pic, id]
      );
      res.redirect('/quanli');
  } catch (error) {
      console.error("Lỗi khi cập nhật dữ liệu:", error);
      res.status(500).send("<div><h1>Lỗi khi sửa dữ liệu</h1><a href='/quanli'>Quay lại</a></div>");
  }
});

//--------------------

// thêm dữ liệu địa điểm
// hiện trang thêm dữ liệu địa điểm
app.get("/plus-diadiem", (reg, res)=> {
  res.render("plus-diadiem")
})
app.post("/plus-diadiem", async (req, res) => {
  const { name, diachi, kinda,  x, y, open, money, pic} = req.body;

  try {
      // xem tọa độ x y co bị trùng không
      const XCheck = await pg.query("SELECT * FROM \"bao_tang\" WHERE toa_do_x = $1", [x]);
      if (XCheck.rows.length > 0) {
          return res.send(`<div><h1>Đã có tọa độ X được thêm vào trước đó <a href="/plus-diadiem">Quay lại</a></h1></div>`);
      }
      const YCheck = await pg.query("SELECT * FROM \"bao_tang\" WHERE toa_do_y = $1", [y]);
      if (YCheck.rows.length > 0) {
          return res.send(`<div><h1>Đã có tọa độ Y được thêm vào trước đó <a href="/plus-diadiem">Quay lại</a></h1></div>`);
      }

      // thêm dữ liệu vào csdl
      await pg.query("INSERT INTO \"bao_tang\" (ten, dia_chi, phan_loai, toa_do_x, toa_do_y, thoi_gian_mo_cua, gia_ve, anh) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [name, diachi, kinda,  x, y, open, money, pic]);

      res.redirect("/quanli");
  } catch (error) {
      console.error("Lỗi khi thêm dữ liệu:", error);
      res.send(`<div><h1>Có lỗi gì đó xảy ra <a href="/plus-diadiem">Quay lại</a></h1></div>`);
  }
});

//--------------------

// lấy dữ liệu địa điểm
app.get('/api/mapp', async (req, res) => {
  try {
      const result = await pg.query('SELECT * FROM bao_tang');
      res.json(result.rows);
  } catch (error) {
      console.error("Lỗi khi lấy dữ liệu địa điểm:", error);
      res.status(500).send(`<div><h1>Lỗi sever<a href="/login">Quay lại</a></h1></div>`);
  }
});

//--------------------

// lọc dữ liệu theo loại bảo tàng
app.get('/api/filter/:type?', async (req, res) => {
  // chọn giá trị loại bảo tàng cho type thì sẽ lấy giá trị đó còn không thì chọn hết 
  const type = req.params.type || '';
  let query = 'SELECT * FROM bao_tang';
  const params = [];
  if (type) {
      query += ' WHERE phan_loai = $1'; 
      params.push(type);
  }

  try {
      const result = await pg.query(query, params);
      res.json(result.rows);
  } catch (err) {
      console.error('Lỗi khi lấy dữ liệu phân loại:', err);
      res.status(500).send(`<div><h1>Lỗi khi phân loại bảng tàng<a href="/trangchu">Quay lại</a></h1></div>`);
  }
});

//--------------------

// đăng xuất cho trang chủ
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          console.error('Lỗi khi đăng xuất:', err);
          return res.status(500).send(`<div><h1>Lỗi đăng xuất<a href="/trangchu">Quay lại</a></h1></div>`);
      }
      res.redirect('/trangchu');
  });
});

//--------------------

// lấy 5 địa điểm ở gần
app.get('/api/near5', async (req, res) => {
  const { lat, lng } = req.query;

  try {
    // công thức tính khoảng cách trong không gian Euclid 2 điểm = (vĩ độ: địa điểm - user)^2 + (kinh độ: địa điểm - user)^2
      const query = `
          SELECT * FROM bao_tang
          ORDER BY (
              (toa_do_x - $1) * (toa_do_x - $1) + (toa_do_y - $2) * (toa_do_y - $2) 
          ) ASC
          LIMIT 5
      `;

      const result = await pg.query(query, [lat, lng]);
      res.json(result.rows);
  } catch (error) {
      console.error('Lỗi khi truy vấn:', error);
      res.status(500).send(`<div><h1>Lỗi máy chủ<a href="/trangchu">Quay lại</a></h1></div>`);
  }
});

//--------------------

// lấy dữ liệu từ bảng đánh giá 
app.get('/api/reviews/:id', (req, res) => {
  const id = req.params.id;
  const query = "SELECT * FROM danh_gia WHERE id = $1 AND status = 'true'";
  
  pg.query(query, [id], (err, result) => {
      if (err) {
          console.error('Lỗi khi lấy đánh giá:', err);
          res.status(500).json({ error: 'Lỗi server' });
      } else {
          res.json(result.rows);
      }
  });
});

//--------------------

// input dữ liệu từ form đánh giá
app.post('/submit_review', async (req, res) => {
  const { diem_so, binh_luan, anh_review, diadiem_id } = req.body;

  try {
    const query = `
      INSERT INTO danh_gia (diem_so, binh_luan, anh_review, id) VALUES ($1, $2, $3, $4)
    `;
    await pg.query(query, [diem_so, binh_luan, anh_review, diadiem_id]);

    res.redirect('/trangchu');
  } catch (err) {
    console.error('Lỗi khi thêm đánh giá:', err);
    res.status(500).send(`<div><h1>Lỗi khi thêm đánh giá<a href="/trangchu">Quay lại</a></h1></div>`);
  }
});


//--------------------

// duyệt đánh giá
app.post('/accpect_danhgia', async (req, res) => {
  const accId = req.body.accId;

  try {
      await pg.query("UPDATE danh_gia SET status = 'true' WHERE cmt_id = $1", [accId]);

      res.redirect('/quanli');
  } catch (error) {
      console.error('Lỗi khi duyệt:', error);
      res.status(500).send(`<div><h1>Lỗi khi duyệt đánh giá<a href="/quanli">Quay lại</a></h1></div>`);
  }
});

//--------------------

// xóa đánh giá
app.post('/delete_danhgia', async (req, res) => {
  const cmtId = req.body.cmtId;

  try {
      const deleteQuery = "DELETE FROM danh_gia WHERE cmt_id = $1";
      await pg.query(deleteQuery, [cmtId]);
      res.redirect('/quanli');
  } catch (error) {
      console.error('Lỗi khi xóa đánh giá:', error);
      res.status(500).send(`<div><h1>Lỗi khi xóa đánh giá<a href="/quanli">Quay lại</a></h1></div>`);
  }
});