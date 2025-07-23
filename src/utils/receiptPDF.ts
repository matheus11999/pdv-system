import jsPDF from 'jspdf';

interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CompanyInfo {
  company_name: string;
  company_document?: string;
  company_phone?: string;
  company_email?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  receipt_message?: string;
  receipt_footer?: string;
}

interface CustomerInfo {
  name?: string;
  current_debt?: number;
  new_debt?: number;
}

interface ReceiptData {
  sale_number: string;
  customer: CustomerInfo;
  payment_method: string;
  payment_details?: any;
  total_amount: number;
  subtotal_amount?: number;
  discount_percentage?: number;
  discount_amount?: number;
  change_amount?: number;
  cash_received?: number;
  items: ReceiptItem[];
  created_at: string;
  is_credit_sale?: boolean;
  due_date?: string;
  company: CompanyInfo;
}

export const generateReceiptPDF = (receiptData: ReceiptData): void => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 120] // Tamanho de cupom fiscal (80mm de largura)
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  let yPosition = 10;

  // Função helper para adicionar texto centralizado
  const addCenteredText = (text: string, y: number, fontSize = 10) => {
    pdf.setFontSize(fontSize);
    const textWidth = pdf.getTextWidth(text);
    const x = (pageWidth - textWidth) / 2;
    pdf.text(text, x, y);
    return y + (fontSize * 0.5);
  };

  // Função helper para adicionar linha
  const addLine = (y: number) => {
    pdf.line(5, y, pageWidth - 5, y);
    return y + 2;
  };

  // Header do estabelecimento
  pdf.setFontSize(12);
  pdf.setFont(undefined, 'bold');
  yPosition = addCenteredText(receiptData.company.company_name || 'PDV SYSTEM', yPosition, 12);
  yPosition += 2;
  
  pdf.setFontSize(8);
  pdf.setFont(undefined, 'normal');
  
  // CNPJ
  if (receiptData.company.company_document) {
    yPosition = addCenteredText(`CNPJ: ${receiptData.company.company_document}`, yPosition, 8);
    yPosition += 1;
  }
  
  // Endereço
  if (receiptData.company.address_street) {
    const address = `${receiptData.company.address_street}, ${receiptData.company.address_city} - ${receiptData.company.address_state}`.replace(/\s+/g, ' ').trim();
    yPosition = addCenteredText(address, yPosition, 8);
    yPosition += 1;
  }
  
  // Telefone
  if (receiptData.company.company_phone) {
    yPosition = addCenteredText(`Tel: ${receiptData.company.company_phone}`, yPosition, 8);
    yPosition += 1;
  }
  
  yPosition += 2;

  yPosition = addLine(yPosition);

  // Informações da venda
  pdf.setFontSize(9);
  pdf.setFont(undefined, 'bold');
  yPosition = addCenteredText(`CUPOM FISCAL #${receiptData.sale_number}`, yPosition, 9);
  yPosition += 3;

  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(8);

  // Data e hora
  const date = new Date(receiptData.created_at);
  const dateStr = date.toLocaleDateString('pt-BR');
  const timeStr = date.toLocaleTimeString('pt-BR');
  yPosition = addCenteredText(`${dateStr} ${timeStr}`, yPosition, 8);
  yPosition += 3;

  // Cliente (se houver)
  if (receiptData.customer.name) {
    yPosition = addCenteredText(`Cliente: ${receiptData.customer.name}`, yPosition, 8);
    yPosition += 2;
  }

  yPosition = addLine(yPosition);

  // Cabeçalho dos itens
  pdf.setFontSize(8);
  pdf.text('Item', 5, yPosition);
  pdf.text('Qtd', 35, yPosition);
  pdf.text('Vlr Unit', 45, yPosition);
  pdf.text('Total', 65, yPosition);
  yPosition += 3;

  yPosition = addLine(yPosition);

  // Itens da venda
  receiptData.items.forEach((item) => {
    // Nome do produto (pode quebrar linha se muito longo)
    const maxWidth = pageWidth - 10;
    const splitTitle = pdf.splitTextToSize(item.name, maxWidth - 20);
    
    for (let i = 0; i < splitTitle.length; i++) {
      if (i === 0) {
        // Primeira linha com todos os dados
        pdf.text(splitTitle[i], 5, yPosition);
        pdf.text(item.quantity.toString(), 35, yPosition);
        pdf.text(`R$ ${item.unit_price.toFixed(2)}`, 45, yPosition);
        pdf.text(`R$ ${item.total_price.toFixed(2)}`, 60, yPosition);
      } else {
        // Linhas adicionais só com o nome do produto
        pdf.text(splitTitle[i], 5, yPosition);
      }
      yPosition += 3;
    }
    yPosition += 1;
  });

  yPosition = addLine(yPosition);

  // Totais
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(10);
  yPosition = addCenteredText(`TOTAL: R$ ${receiptData.total_amount.toFixed(2)}`, yPosition, 10);
  yPosition += 3;

  // Método de pagamento
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(8);
  const paymentMethods: Record<string, string> = {
    CASH: 'Dinheiro',
    CREDIT_CARD: 'Cartão de Crédito',
    DEBIT_CARD: 'Cartão de Débito',
    PIX: 'PIX',
    CREDIT: 'Fiado'
  };
  
  const paymentLabel = paymentMethods[receiptData.payment_method] || receiptData.payment_method;
  yPosition = addCenteredText(`Pagamento: ${paymentLabel}`, yPosition, 8);
  yPosition += 2;

  // Detalhes do pagamento em dinheiro
  if (receiptData.payment_method === 'CASH') {
    if (receiptData.cash_received && receiptData.cash_received > 0) {
      yPosition = addCenteredText(`Recebido: R$ ${receiptData.cash_received.toFixed(2)}`, yPosition, 8);
      yPosition += 2;
    }
    
    if (receiptData.change_amount && receiptData.change_amount > 0) {
      yPosition = addCenteredText(`Troco: R$ ${receiptData.change_amount.toFixed(2)}`, yPosition, 8);
      yPosition += 2;
    }
  }

  // Informações de venda fiado
  if (receiptData.is_credit_sale) {
    yPosition += 2;
    pdf.setFont(undefined, 'bold');
    yPosition = addCenteredText('*** VENDA FIADO ***', yPosition, 9);
    yPosition += 2;
    
    pdf.setFont(undefined, 'normal');
    if (receiptData.due_date) {
      const dueDate = new Date(receiptData.due_date);
      yPosition = addCenteredText(`Vencimento: ${dueDate.toLocaleDateString('pt-BR')}`, yPosition, 8);
      yPosition += 2;
    }
    
    // Saldo devedor
    if (receiptData.customer.new_debt !== undefined) {
      yPosition = addCenteredText(`Saldo devedor: R$ ${receiptData.customer.new_debt.toFixed(2)}`, yPosition, 8);
      yPosition += 2;
    }
  }

  yPosition = addLine(yPosition);

  // Footer
  pdf.setFontSize(7);
  yPosition = addCenteredText(receiptData.company.receipt_message || 'Obrigado pela preferência!', yPosition, 7);
  yPosition += 2;
  yPosition = addCenteredText(receiptData.company.receipt_footer || 'Volte sempre!', yPosition, 7);

  // Salvar o PDF
  const filename = `cupom-${receiptData.sale_number}-${Date.now()}.pdf`;
  pdf.save(filename);
};

export const generateReceiptHTML = (receiptData: ReceiptData): string => {
  const date = new Date(receiptData.created_at);
  const dateStr = date.toLocaleDateString('pt-BR');
  const timeStr = date.toLocaleTimeString('pt-BR');

  const paymentMethods: Record<string, string> = {
    CASH: 'Dinheiro',
    CREDIT_CARD: 'Cartão de Crédito',
    DEBIT_CARD: 'Cartão de Débito',
    PIX: 'PIX',
    CREDIT: 'Fiado'
  };

  const paymentLabel = paymentMethods[receiptData.payment_method] || receiptData.payment_method;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cupom Fiscal #${receiptData.sale_number}</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
            .receipt { box-shadow: none; border: none; }
        }
        body {
            font-family: 'Courier New', monospace;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .receipt {
            width: 350px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            font-size: 12px;
            line-height: 1.4;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
        }
        .company-name {
            font-size: 18px;
            font-weight: bold;
            margin: 0 0 5px 0;
        }
        .company-info {
            font-size: 10px;
            margin: 2px 0;
            color: #666;
        }
        .sale-info {
            text-align: center;
            margin-bottom: 15px;
            padding: 10px;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .sale-number {
            font-size: 16px;
            font-weight: bold;
            margin: 0 0 8px 0;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .items-table th {
            background-color: #e9ecef;
            padding: 5px 3px;
            font-size: 10px;
            border-bottom: 1px solid #000;
        }
        .items-table td {
            padding: 3px;
            font-size: 10px;
            border-bottom: 1px dotted #ccc;
        }
        .item-name {
            max-width: 150px;
            word-wrap: break-word;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .total-section {
            border-top: 2px solid #000;
            padding-top: 10px;
            text-align: center;
            margin-bottom: 15px;
        }
        .total-amount {
            font-size: 18px;
            font-weight: bold;
            margin: 10px 0;
        }
        .payment-info {
            background-color: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 15px;
        }
        .credit-sale {
            border: 2px solid #dc3545;
            background-color: #fff5f5;
            padding: 10px;
            margin: 15px 0;
            border-radius: 5px;
            text-align: center;
        }
        .credit-sale-title {
            font-weight: bold;
            color: #dc3545;
            font-size: 14px;
            margin-bottom: 5px;
        }
        .footer {
            text-align: center;
            border-top: 1px dotted #000;
            padding-top: 10px;
            font-size: 10px;
            color: #666;
        }
        .print-button {
            background-color: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin: 20px auto;
            display: block;
        }
        .print-button:hover {
            background-color: #218838;
        }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <h1 class="company-name">${receiptData.company.company_name || 'PDV SYSTEM'}</h1>
            ${receiptData.company.company_document ? `<p class="company-info">CNPJ: ${receiptData.company.company_document}</p>` : ''}
            ${receiptData.company.address_street ? `<p class="company-info">${receiptData.company.address_street}</p>` : ''}
            ${receiptData.company.address_city ? `<p class="company-info">${receiptData.company.address_city} - ${receiptData.company.address_state || ''}</p>` : ''}
            ${receiptData.company.company_phone ? `<p class="company-info">Tel: ${receiptData.company.company_phone}</p>` : ''}
            ${receiptData.company.company_email ? `<p class="company-info">Email: ${receiptData.company.company_email}</p>` : ''}
        </div>

        <div class="sale-info">
            <h2 class="sale-number">CUPOM FISCAL #${receiptData.sale_number}</h2>
            <p style="margin: 5px 0;">${dateStr} às ${timeStr}</p>
            ${receiptData.customer.name ? `<p style="margin: 5px 0; font-weight: bold;">Cliente: ${receiptData.customer.name}</p>` : ''}
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th class="text-left">Item</th>
                    <th class="text-center">Qtd</th>
                    <th class="text-right">Vlr Unit</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${receiptData.items.map(item => `
                    <tr>
                        <td class="item-name">${item.name}</td>
                        <td class="text-center">${item.quantity}</td>
                        <td class="text-right">R$ ${item.unit_price.toFixed(2)}</td>
                        <td class="text-right">R$ ${item.total_price.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="total-section">
            ${receiptData.discount_percentage && receiptData.discount_percentage > 0 ? `
                <div style="margin-bottom: 15px; padding: 10px; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 5px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Subtotal:</span>
                        <span>R$ ${receiptData.subtotal_amount?.toFixed(2) || receiptData.total_amount.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; color: #ea580c; font-weight: bold;">
                        <span>Desconto (${receiptData.discount_percentage}%):</span>
                        <span>-R$ ${receiptData.discount_amount?.toFixed(2) || '0.00'}</span>
                    </div>
                </div>
            ` : ''}
            <div class="total-amount">TOTAL: R$ ${receiptData.total_amount.toFixed(2)}</div>
        </div>

        <div class="payment-info">
            <p style="margin: 5px 0; font-weight: bold;">Forma de Pagamento: ${paymentLabel}</p>
            ${receiptData.payment_method === 'CASH' && receiptData.cash_received ? 
                `<p style="margin: 5px 0;">Valor Recebido: R$ ${receiptData.cash_received.toFixed(2)}</p>` : ''}
            ${receiptData.payment_method === 'CASH' && receiptData.change_amount && receiptData.change_amount > 0 ? 
                `<p style="margin: 5px 0; font-weight: bold;">Troco: R$ ${receiptData.change_amount.toFixed(2)}</p>` : ''}
        </div>

        ${receiptData.is_credit_sale ? `
            <div class="credit-sale">
                <div class="credit-sale-title">*** VENDA FIADO ***</div>
                ${receiptData.due_date ? 
                    `<p style="margin: 5px 0;">Vencimento: ${new Date(receiptData.due_date).toLocaleDateString('pt-BR')}</p>` : ''}
                ${receiptData.customer.new_debt !== undefined ? 
                    `<p style="margin: 5px 0; font-weight: bold;">Saldo Devedor: R$ ${receiptData.customer.new_debt.toFixed(2)}</p>` : ''}
            </div>
        ` : ''}

        <div class="footer">
            <p>${receiptData.company.receipt_message || 'Obrigado pela preferência!'}</p>
            <p>${receiptData.company.receipt_footer || 'Volte sempre!'}</p>
            <p>---</p>
            <p>Sistema PDV - ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
    </div>

    <button class="print-button no-print" onclick="window.print()">
        🖨️ Imprimir Cupom
    </button>

    <script>
        // Auto print after 1 second
        setTimeout(() => {
            window.print();
        }, 1000);
    </script>
</body>
</html>
  `;
};

// Função para abrir comprovante em nova aba com impressão automática
export const openReceiptInNewTab = (receiptData: ReceiptData): void => {
  const htmlContent = generateReceiptHTML(receiptData);
  const newWindow = window.open('', '_blank');
  
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
    
    // Focar na nova janela
    newWindow.focus();
  } else {
    alert('Por favor, permita pop-ups para abrir o comprovante.');
  }
};