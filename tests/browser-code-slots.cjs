// Focused React DOM/motion test. No application server, auth endpoint or email involved.
const { chromium, expect } = require('@playwright/test');
const { build } = require('esbuild');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');

(async () => {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React,{useState} from 'react';import{createRoot}from'react-dom/client';import CodeSlots from './src/components/reactbits/CodeSlots';
    function Harness(){const[value,setValue]=useState(''),[status,setStatus]=useState('idle'),[disabled,setDisabled]=useState(false),[mounted,setMounted]=useState(true),[kk,setKk]=useState(false),[mask,setMask]=useState(false);window.qaValue=value;window.qaStatus=status;return <><div id="harness">{mounted&&<CodeSlots value={value} onChange={v=>{window.qaChanges.push(v);setValue(v)}} onComplete={v=>window.qaCompleted.push(v)} status={status} disabled={disabled} mask={mask} ariaLabel={kk?'Растау коды':'Код подтверждения'} acceptedLabel={kk?'Код қабылданды':'Код принят'} errorLabel={kk?'Код қате':'Код неверный'} countLabel={(n,total)=>kk?total+' цифрдың '+n+' енгізілді':'Введено '+n+' из '+total}/>}</div><button onClick={()=>setDisabled(x=>!x)}>disabled</button><button onClick={()=>setStatus('error')}>error</button><button onClick={()=>setStatus('success')}>success</button><button onClick={()=>setStatus('idle')}>idle</button><button onClick={()=>setValue('')}>clear</button><button onClick={()=>setValue('654321')}>external</button><button onClick={()=>setMounted(false)}>unmount</button><button onClick={()=>setKk(true)}>kk</button><button onClick={()=>setMask(true)}>mask</button></>};window.qaChanges=[];window.qaCompleted=[];createRoot(document.getElementById('root')).render(<Harness/>);`
  }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' } });
  const css = await fs.readFile('src/components/reactbits/CodeSlots.css', 'utf8');
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>');
      await page.addStyleTag({ content: css + '\nbody{margin:24px;background:#17141d;color:white;font-family:Arial}button{margin:8px}#harness{padding:12px 0}' });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      const input = page.getByRole('textbox', { name: 'Код подтверждения' });
      await input.focus(); await input.pressSequentially('123456');
      await expect(input).toHaveValue('123456');
      assert.deepEqual(await page.evaluate(() => window.qaCompleted), ['123456']);
      // Repeat paste and controlled parent echo must not trigger another verification.
      const paste = text => input.evaluate((element, text) => { const data = new DataTransfer(); data.setData('text/plain', text); element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })); }, text);
      await paste('123 456'); assert.deepEqual(await page.evaluate(() => window.qaCompleted), ['123456']);
      await input.press('Backspace'); await expect(input).toHaveValue('12345');
      await input.press('6'); assert.equal((await page.evaluate(() => window.qaCompleted)).length, 2);
      await input.press('Home'); await input.press('9'); await expect(input).toHaveValue('923456');
      await input.press('ArrowRight'); await input.press('Delete'); await expect(input).toHaveValue('92456');
      await page.getByRole('button', { name: 'clear', exact: true }).click();
      await expect(input).toHaveValue(''); await input.focus(); await paste('ab 987-654!'); await expect(input).toHaveValue('987654');
      const beforeExternal = (await page.evaluate(() => window.qaCompleted)).length;
      await page.getByRole('button', { name: 'external', exact: true }).click(); await expect(input).toHaveValue('654321');
      assert.equal((await page.evaluate(() => window.qaCompleted)).length, beforeExternal);
      // fill uses a native input event path, like mobile keyboard/OTP autofill.
      await page.getByRole('button', { name: 'clear', exact: true }).click(); await input.fill('135790'); await expect(input).toHaveValue('135790');
      await input.fill('13579'); await expect(input).toHaveValue('13579'); await input.fill('135790');
      await page.getByRole('button', { name: 'disabled', exact: true }).click(); await expect(input).toBeDisabled();
      await paste('222222'); await expect(input).toHaveValue('135790');
      await page.getByRole('button', { name: 'disabled', exact: true }).click();
      await page.getByRole('button', { name: 'error', exact: true }).click(); await expect(input).toHaveAttribute('aria-invalid', 'true'); await expect(input).toHaveValue('');
      await page.getByRole('button', { name: 'idle', exact: true }).click(); await input.fill('246810');
      await page.getByRole('button', { name: 'success', exact: true }).click(); await expect(input).toHaveAttribute('readonly', ''); await expect(page.locator('.code-slots__sr')).toHaveText('Код принят');
      await page.getByRole('button', { name: 'idle', exact: true }).click(); await expect(input).not.toHaveAttribute('readonly', '');
      await expect.poll(() => page.locator('.code-slots__wash').evaluate(el => getComputedStyle(el).clipPath)).toMatch(/50%/);
      await page.getByRole('button', { name: 'kk', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'Растау коды' })).toHaveValue('246810');
      await expect(page.locator('.code-slots__sr')).toHaveText('6 цифрдың 6 енгізілді');
      await page.getByRole('button', { name: 'mask', exact: true }).click(); await expect(page.locator('.code-slots__input')).toHaveAttribute('type', 'password'); await expect(page.locator('.code-slots__digit').first()).toHaveText('•');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `tmp/qa-codeslots-${reducedMotion}.png` });
      // An interrupted error animation may not clear state after unmount.
      await page.getByRole('button', { name: 'error', exact: true }).click(); await page.getByRole('button', { name: 'unmount', exact: true }).click();
      const changeCount = (await page.evaluate(() => window.qaChanges)).length;
      await page.waitForTimeout(600); assert.equal((await page.evaluate(() => window.qaChanges)).length, changeCount);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ pass: 'CodeSlots keyboard, paste, controlled echo, mobile input/delete, disabled, error/success, RU/KK, mask and unmount cleanup', reducedMotion, width:390, pageErrors:0 }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
