const express = require('express');
const net = require('net');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
app.use(bodyParser.json());

const CONTROLLER_IP = process.env.CONTROLLER_IP || '192.168.42.93';
const CONTROLLER_PORT = parseInt(process.env.CONTROLLER_PORT || '23',10);

let tcpClient=null;
let tcpBuffer='';

function ensureConnection(){
  if(tcpClient && !tcpClient.destroyed) return Promise.resolve();
  return new Promise((res, rej)=> {
    tcpClient = new net.Socket();
    tcpClient.connect(CONTROLLER_PORT, CONTROLLER_IP, ()=>{ console.log('TCP connected'); res(); });
    tcpClient.on('data', d=> tcpBuffer+=d.toString());
    tcpClient.on('error', e=> console.error('tcp err', e.message));
    tcpClient.on('close', ()=> { console.log('tcp closed'); tcpClient=null; });
    setTimeout(()=>res(), 400);
  });
}

app.post('/api/send', async (req,res)=>{
  const cmd = (req.body.cmd||'').toString();
  if(!cmd) return res.status(400).json({error:'no cmd'});
  try{
    await ensureConnection();
    tcpClient.write(cmd + '\r');
    setTimeout(()=>{ const r = tcpBuffer; tcpBuffer=''; res.json({ok:true,reply:r}); }, 150);
  }catch(e){ res.status(500).json({error: e.message}); }
});

// convenience endpoints for macros (LM/LI demo, calibration template)
app.post('/api/macro/:name', async (req,res)=>{
  const name = req.params.name;
  const macros = {
    // LM/LI demo - ADJUST counts/speeds to your system BEFORE running on real hardware!
    "lm_demo": [
      "LM AB",
      "LI 10000,10000",
      "VS 5000",
      "VA 20000",
      "VD 20000",
      "BGS"
    ].join(';'),
    // calibration template — be cautious. This is a template only.
    "calibrate_home": [
      "SP 2000,2000",
      "JG 1000,0",
      "ST AB"
    ].join(';')
  };
  if(!macros[name]) return res.status(404).json({error:'unknown macro'});
  try{ await ensureConnection(); tcpClient.write(macros[name] + '\r'); setTimeout(()=>{ const r=tcpBuffer; tcpBuffer=''; res.json({ok:true,reply:r}); }, 200); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/api/ping', async (req,res)=>{ try{ await ensureConnection(); res.json({connected: !!tcpClient}); }catch(e){ res.json({connected:false, error:e.message}); } });

app.use('/', express.static(path.join(__dirname,'static')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Server listening on',PORT));
