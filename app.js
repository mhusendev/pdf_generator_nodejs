require('dotenv').config()
const config = require('./config/database');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const pool = mysql.createPool(config);
var crypto = require('crypto');
let tokens = []

let express = require("express");
let app = express();
let ejs = require("ejs");
let pdf = require("html-pdf");
let path = require("path");
const fs = require('fs');
var cors = require('cors')

const bodyParser = require('body-parser');
app.use(cors())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())
const pdfPath = path.join(__dirname, './frontend/pdf'); 
app.use("/assets",express.static('assets')); 
app.use("/pdf", express.static("/pdf"));
// kasir
const pdfPath_kasir = path.join(__dirname, './kasir/pdf');
app.use("/kasir/pdf", express.static("/kasir/pdf")); 
// kumpulan function
let datas = '';
var subtotal = 0
function loopdata(datas) {
    subtotal = 0
    for (let i in datas.barang) {
 
        subtotal += parseInt(datas.barang[i].jumlah)
      datas.barang[i].harga = parseDecimal(datas.barang[i].harga)
      datas.barang[i].jumlah = parseDecimal(datas.barang[i].jumlah)

}
return datas;
}
function parseDecimal(bilangan) {
    var number_string = bilangan.toString(),
        sisa = number_string.length % 3,
        rupiah = number_string.substr(0, sisa),
        ribuan = number_string.substr(sisa).match(/\d{3}/g);

    if (ribuan) {
        separator = sisa ? '.' : '';
        rupiah += separator + ribuan.join('.');
    }
    return "IDR " + rupiah
}

// kumpulan request

app.get("/pdf_list",authenticateToken,(req, res) => {

    fs.readdir(pdfPath, function (err, files) {
        let datapdf = []
        //handling error
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        } 
        //listing all files using forEach
        files.forEach(function (file) {
            // Do whatever you want to do with the file
            // console.log(file);
            let files = { link : "https://penawaran.cws.co.id/pdf/"+file,
                          //link : "./frontend/pdf/"+file,
                          berkas: file}
            datapdf.push(files) 
        });

        res.send(JSON.stringify(datapdf))
    });
})


app.post("/generateReport", authenticateToken, async function (req, res){
      datas = req.body;
 
   
     datas = await loopdata(datas)
     datas.subtotal = parseDecimal(subtotal)
     var potongan = subtotal * 10 / 100
     datas.ppn = parseDecimal(potongan)
     datas.total = parseDecimal(subtotal + potongan)
     console.log(subtotal)
    ejs.renderFile(path.join(__dirname, './views/', "laporan.ejs"), {datas}, (err, data) => {
    if (err) {
          res.send(err);
    } else {
        let options = {
            // "height": "16.25in",
            // "width": "11.75in",
            "format": "A4",
            "header": {
                "height": "35mm",
            },
         
            "footer": {
                "height": "15mm",
                "contents": {
                  default: '<span style="color: #444; float:right; margin-right:47%; ">{{page}}</span>', // fallback value
                }
            }
        };    // let options2 = { format: 'A4' };
        pdf.create(data, options).toFile("./frontend/pdf/"+req.body.pdf_name+".pdf", function (err, data) {
            if (err) {
                res.send(err);
            } else {

                res.send("File created successfully");
            }
        });
    }
});
})

app.delete("/logout", (req,res) =>{
    tokens = tokens.filter(token => token !== req.body.token)
    res.sendStatus(201)
});
 function authenticateToken(req,res,next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token == null) return res.sendStatus(401)
    b = tokens.filter(e => e.token === token);
    console.log(b)
 if(b.length !== 0) {
    if (b[0].token === token){
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
            if (err) return res.sendStatus(405)
            console.log(user)
            req.user = user
            next()
        })
    }
 } else { res.sendStatus(404) }
  
}
// login auth
app.post("/login", (req, res) => {
    b = tokens.filter(e => e.user === req.body.nama_pengguna);
    b.forEach(f => tokens.splice(tokens.findIndex(e => e.user === f.user),1));

    console.log(tokens.length)
    console.log(tokens)
    var sandi = '';
    let token_user = { name: req.body.nama_pengguna }
    if(req.body.kata_sandi !== "" && req.body.nama_pengguna !== "") {
       
       pool.getConnection(function(err, connection){
        if(err) {console.log(err);}
        
        connection.query(`SELECT json_extract(data_json,'$.kata_sandi') AS  sandi, json_extract(data_json,'$.nama_lengkap') AS  nama, id  FROM tabel_user  WHERE json_extract(data_json, '$.nama_pengguna') = ? AND json_extract(data_json,'$.kata_sandi') = ?`,
        [req.body.nama_pengguna,crypto.createHash('sha256').update(req.body.kata_sandi).digest('hex')], function (err, results) {
            console.log(results)
            sandi = req.body.kata_sandi = crypto.createHash('sha256').update(req.body.kata_sandi).digest('hex');
            if(err){
                console.log(err)
            }
            if (results.length == 0) { console.log("nama gada"); res.sendStatus(404);} 
            else {
            //console.log(results[0].nama.replace(/^"(.*)"$/, '$1'))
            nama = results[0].nama.replace(/^"(.*)"$/, '$1')
            str_sandi = results[0].sandi.replace(/^"(.*)"$/, '$1');
            const accessToken = jwt.sign(token_user, process.env.ACCESS_TOKEN_SECRET)
           tokens.push({'token':accessToken,'user':req.body.nama_pengguna})
           //    tokens.push(accessToken)
            if ( sandi === str_sandi) {
                console.log("berhasil login dengan user: "+ nama)
                json_hasil = {
                "pesan" : "Login Berhasil",
                "nama" : nama ,
                "id" : results[0].id,
                "token": accessToken }
                res.send(JSON.stringify(json_hasil))
            } else {
                res.send('{ "pesan" : "Login Gagal" }')
            }
            }
        }) 

    })
    } else {
        res.send('{ "pesan" : "Masukan Sandi" }.')
    }


    
});

// aplikasi kasir
app.post("/generateStruk",authenticateToken, async function (req, res){
    datas = req.body;

 
   datas = await loopdata(datas)
   datas.subtotal = parseDecimal(subtotal)
   var potongan = subtotal * 10 / 100
   datas.ppn = parseDecimal(potongan)
   datas.total = parseDecimal(subtotal + potongan)
   console.log(datas)
  ejs.renderFile(path.join(__dirname, './views/', "struk.ejs"), {datas}, (err, data) => {
  if (err) {
        res.send(err);
  } else {
      let options = {
          "height": "75mm",
          "width": "60mm",
         
          "header": {
              "height": "5mm",
          },
       
          "footer": {
              "height": "5mm",
              "contents": {
                default: '<span style="color: #444; float:right; margin-right:47%; ">{{page}}</span>', // fallback value
              }
          }
      };    // let options2 = { format: 'A4' };
      pdf.create(data, options).toFile("./kasir/pdf/"+Date()+".pdf", function (err, data) {
          if (err) {
              res.send(err);
          } else {

              res.send("File created successfully");
          }
      });
  }
});
})
app.get("/struk_list",(req, res) => {

    fs.readdir(pdfPath_kasir, function (err, files) {
        let datapdf = []
        //handling error
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        } 
        //listing all files using forEach
        files.forEach(function (file) {
            // Do whatever you want to do with the file
            // console.log(file);
            let files = { link : "https://kasir.cws.co.id/pdf/"+file,
                          //link : "./kasir/pdf/"+file,
                          berkas: file}
            datapdf.push(files) 
        });

        res.send(JSON.stringify(datapdf))
    });
})

app.listen(3000);
