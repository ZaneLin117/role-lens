import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const browser=await chromium.launch({channel:'chrome',headless:true});
const mode=process.argv.includes('--live')?'live':process.argv.includes('--offline')?'offline':'dev';
const url=process.env.ROLELENS_TEST_URL || (mode==='live'?'https://zanelin117.github.io/role-lens/':mode==='offline'?pathToFileURL(path.resolve('dist/index.html')).href:'http://127.0.0.1:5173/');
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{timeout:60000});await page.getByTestId('result-count').waitFor({timeout:45000});await page.locator('.loading-overlay').waitFor({state:'detached'});
  assert.equal(await page.getByText('找到适合你的岗位',{exact:true}).count(),0);
  for (const width of [1440,1024]) {
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok((await page.locator('.table-card').boundingBox()).y<130);
    for(const name of ['搜索岗位','保存筛选','导出结果'])assert.ok(await page.getByRole('button',{name,exact:true}).isVisible());
  }
  await page.getByRole('button',{name:'搜索岗位',exact:true}).click();await page.getByLabel('搜索全部岗位字段',{exact:true}).fill('福建省');await page.getByLabel('搜索全部岗位字段',{exact:true}).press('Enter');
  await page.waitForFunction(()=>document.querySelector('[data-testid="result-count"]')?.textContent==='686');
  await page.getByRole('button',{name:'保存筛选',exact:true}).click();await page.getByRole('button',{name:'清除全部',exact:true}).click();
  await page.screenshot({path:`.local/compact-desktop-${mode}.png`});
  await page.close();
  const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});phone.setDefaultTimeout(20000);phone.on('pageerror',e=>errors.push(e.message));
  await phone.goto(url,{timeout:60000});await phone.getByTestId('result-count').waitFor({timeout:45000});await phone.locator('.loading-overlay').waitFor({state:'detached'});
  assert.equal(await phone.locator('.mobile-job').count(),20);assert.equal(await phone.getByLabel('每页岗位数',{exact:true}).inputValue(),'20');
  for(const width of [320,390,430,768]) {
    await phone.setViewportSize({width,height:844});
    assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),String(width));
    assert.ok(!await phone.locator('.sidebar').isVisible());
    assert.ok((await phone.locator('.mobile-job').first().boundingBox()).y<360);
  }
  await phone.setViewportSize({width:390,height:844});
  await phone.screenshot({path:`.local/compact-phone-${mode}.png`});
  await phone.getByRole('button',{name:'展开筛选条件',exact:true}).click();
  await phone.getByLabel('工作表',{exact:true}).selectOption('1');
  await phone.getByLabel('专业关键词',{exact:true}).fill('计算机');
  assert.equal(await phone.getByLabel('专业关键词',{exact:true}).evaluate(el=>getComputedStyle(el).fontSize),'16px');
  await phone.getByRole('button',{name:/^查看 [\d,]+ 个岗位$/}).click();
  assert.ok(!await phone.locator('.sidebar').isVisible());assert.ok((await phone.locator('.mobile-job').first().boundingBox()).y<360);
  const firstCode=await phone.locator('.mobile-job-code>span').first().innerText();
  await phone.locator('.mobile-job .favorite-button').first().click();
  await phone.getByRole('button',{name:/我的收藏/}).click();await phone.waitForFunction(()=>document.querySelector('[data-testid="result-count"]')?.textContent==='1');
  await phone.locator('.mobile-job .detail-button').first().click();await phone.getByText('备注原文',{exact:true}).waitFor();
  await phone.screenshot({path:`.local/compact-detail-${mode}.png`});await phone.getByRole('button',{name:'完成',exact:true}).click();
  await phone.getByRole('button',{name:'全部岗位',exact:true}).click();
  await phone.getByRole('button',{name:'搜索岗位',exact:true}).click();await phone.getByLabel('搜索全部岗位字段',{exact:true}).fill(firstCode);await phone.getByLabel('搜索全部岗位字段',{exact:true}).press('Enter');
  await phone.waitForFunction(()=>document.querySelector('[data-testid="result-count"]')?.textContent==='1');
  await phone.getByRole('button',{name:'清除全部',exact:true}).click();
  await phone.locator('.column-picker>summary').click();await phone.getByLabel('岗位排序',{exact:true}).selectOption(JSON.stringify({column:'招考人数',direction:'desc'}));
  assert.ok(await phone.locator('.mobile-job').first().getByText('招考', {exact:false}).count());
  await phone.getByRole('button',{name:'搜索岗位',exact:true}).click();await phone.getByRole('button',{name:'取消',exact:true}).click();
  await phone.getByRole('button',{name:'下一页',exact:true}).click();
  assert.ok((await phone.locator('.pagination').innerText()).includes('21–40'));assert.ok((await phone.locator('.mobile-job').first().boundingBox()).y<360);
  await phone.getByRole('button',{name:'个人信息',exact:true}).click();const dialog=phone.getByRole('dialog',{name:'个人基础信息',exact:true});
  await dialog.getByLabel('最高学历层次',{exact:true}).selectOption('本科');await dialog.getByLabel('最高学历专业',{exact:true}).fill('数字媒体');
  assert.equal(await dialog.getByLabel('最高学历专业',{exact:true}).evaluate(el=>getComputedStyle(el).fontSize),'16px');
  await dialog.getByRole('listbox',{name:'最高学历专业选项',exact:true}).getByRole('option',{name:/^数字媒体技术\s/}).click();assert.equal(await dialog.getByLabel('最高学历专业代码',{exact:true}).inputValue(),'080906');
  await phone.setViewportSize({width:390,height:500});assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok((await dialog.locator('.profile-dialog-footer').boundingBox()).y<500);await dialog.getByRole('button',{name:'取消',exact:true}).click();
  await phone.setViewportSize({width:1024,height:768});await phone.locator('tbody tr').first().waitFor();assert.ok(await phone.locator('.sidebar').isVisible());
  assert.deepEqual(errors,[]);console.log(JSON.stringify({mode,headingRemoved:true,desktopWidths:[1024,1440],phoneWidths:[320,390,430,768],firstJobInFirstScreen:true,collapsedFilters:true,searchSaveFavoriteDetailSortPaging:true,profileMajor:true,runtimeErrors:0}));await phone.close();
} finally {await browser.close();}
