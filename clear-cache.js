#!/usr/bin/env node

// Script para limpar cache completo do desenvolvimento

const fs = require('fs');
const path = require('path');

function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

console.log('🧹 Limpando cache do Vite...');
deleteFolderRecursive('./node_modules/.vite');

console.log('🧹 Limpando dist...');
deleteFolderRecursive('./dist');

console.log('✅ Cache limpo com sucesso!');
console.log('💡 Agora execute: npm run dev');