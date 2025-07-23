import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReceiptData {
  sale: {
    id: string;
    sale_number: string;
    total_amount: number;
    payment_method: string;
    sale_date: string;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
  };
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  customer?: {
    name: string;
    phone?: string;
    email?: string;
  };
  cashier: {
    name: string;
  };
  store: {
    store_name: string;
    store_address?: string;
    store_phone?: string;
  };
}

interface CreditReceiptData {
  customer: {
    name: string;
    phone?: string;
    credit_balance: number;
  };
  transaction: {
    amount: number;
    type: 'PAYMENT';
    description: string;
    created_at: string;
  };
  cashier: {
    name: string;
  };
  store: {
    store_name: string;
    store_address?: string;
    store_phone?: string;
  };
}

export const generateSaleReceipt = (data: ReceiptData): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200] // Receipt size: 80mm width
  });

  let yPos = 10;
  
  // Store header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.store.store_name, 40, yPos, { align: 'center' });
  yPos += 6;
  
  if (data.store.store_address) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(data.store.store_address, 40, yPos, { align: 'center' });
    yPos += 4;
  }
  
  if (data.store.store_phone) {
    doc.text(`Tel: ${data.store.store_phone}`, 40, yPos, { align: 'center' });
    yPos += 4;
  }
  
  // Separator line
  doc.setLineWidth(0.1);
  doc.line(5, yPos, 75, yPos);
  yPos += 6;
  
  // Sale info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Cupom: #${data.sale.sale_number}`, 5, yPos);
  yPos += 4;
  
  doc.setFont('helvetica', 'normal');
  const saleDate = format(new Date(data.sale.sale_date), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  doc.text(`Data: ${saleDate}`, 5, yPos);
  yPos += 4;
  
  doc.text(`Operador: ${data.cashier.name}`, 5, yPos);
  yPos += 4;
  
  if (data.customer) {
    doc.text(`Cliente: ${data.customer.name}`, 5, yPos);
    yPos += 4;
  }
  
  // Separator line
  doc.line(5, yPos, 75, yPos);
  yPos += 6;
  
  // Items header
  doc.setFont('helvetica', 'bold');
  doc.text('Item', 5, yPos);
  doc.text('Qtd', 35, yPos);
  doc.text('Valor', 50, yPos);
  doc.text('Total', 65, yPos);
  yPos += 4;
  
  doc.line(5, yPos, 75, yPos);
  yPos += 4;
  
  // Items
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  data.items.forEach((item) => {
    // Product name (wrap if too long)
    const productName = item.product_name.length > 25 
      ? item.product_name.substring(0, 22) + '...' 
      : item.product_name;
    
    doc.text(productName, 5, yPos);
    doc.text(item.quantity.toString(), 35, yPos);
    doc.text(`R$ ${item.unit_price.toFixed(2)}`, 50, yPos);
    doc.text(`R$ ${item.total_price.toFixed(2)}`, 65, yPos);
    yPos += 4;
  });
  
  // Separator line
  yPos += 2;
  doc.line(5, yPos, 75, yPos);
  yPos += 4;
  
  // Totals
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  if (data.sale.discount_amount > 0) {
    doc.text('Subtotal:', 35, yPos);
    doc.text(`R$ ${data.sale.subtotal.toFixed(2)}`, 65, yPos, { align: 'right' });
    yPos += 4;
    
    doc.text('Desconto:', 35, yPos);
    doc.text(`-R$ ${data.sale.discount_amount.toFixed(2)}`, 65, yPos, { align: 'right' });
    yPos += 4;
  }
  
  if (data.sale.tax_amount > 0) {
    doc.text('Impostos:', 35, yPos);
    doc.text(`R$ ${data.sale.tax_amount.toFixed(2)}`, 65, yPos, { align: 'right' });
    yPos += 4;
  }
  
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 35, yPos);
  doc.text(`R$ ${data.sale.total_amount.toFixed(2)}`, 65, yPos, { align: 'right' });
  yPos += 6;
  
  // Payment method
  doc.setFont('helvetica', 'normal');
  const paymentMethods = {
    'CASH': 'Dinheiro',
    'CREDIT_CARD': 'Cartão de Crédito',
    'DEBIT_CARD': 'Cartão de Débito',
    'PIX': 'PIX',
    'CREDIT': 'Fiado'
  };
  doc.text(`Pagamento: ${paymentMethods[data.sale.payment_method as keyof typeof paymentMethods] || data.sale.payment_method}`, 5, yPos);
  yPos += 6;
  
  // Footer
  doc.setFontSize(8);
  doc.text('Obrigado pela preferência!', 40, yPos, { align: 'center' });
  yPos += 4;
  doc.text('Volte sempre!', 40, yPos, { align: 'center' });
  
  // Save PDF
  const fileName = `cupom-${data.sale.sale_number}-${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`;
  doc.save(fileName);
};

export const generateCreditPaymentReceipt = (data: CreditReceiptData): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 150]
  });

  let yPos = 10;
  
  // Store header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.store.store_name, 40, yPos, { align: 'center' });
  yPos += 6;
  
  if (data.store.store_address) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(data.store.store_address, 40, yPos, { align: 'center' });
    yPos += 4;
  }
  
  if (data.store.store_phone) {
    doc.text(`Tel: ${data.store.store_phone}`, 40, yPos, { align: 'center' });
    yPos += 4;
  }
  
  // Separator line
  doc.setLineWidth(0.1);
  doc.line(5, yPos, 75, yPos);
  yPos += 6;
  
  // Payment info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROVANTE DE PAGAMENTO', 40, yPos, { align: 'center' });
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const paymentDate = format(new Date(data.transaction.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  doc.text(`Data: ${paymentDate}`, 5, yPos);
  yPos += 4;
  
  doc.text(`Cliente: ${data.customer.name}`, 5, yPos);
  yPos += 4;
  
  if (data.customer.phone) {
    doc.text(`Telefone: ${data.customer.phone}`, 5, yPos);
    yPos += 4;
  }
  
  doc.text(`Operador: ${data.cashier.name}`, 5, yPos);
  yPos += 6;
  
  // Separator line
  doc.line(5, yPos, 75, yPos);
  yPos += 6;
  
  // Payment details
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR PAGO:', 5, yPos);
  doc.text(`R$ ${data.transaction.amount.toFixed(2)}`, 65, yPos, { align: 'right' });
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Descrição: ${data.transaction.description}`, 5, yPos);
  yPos += 6;
  
  // New balance
  const newBalance = data.customer.credit_balance - data.transaction.amount;
  doc.setFont('helvetica', 'bold');
  doc.text('SALDO RESTANTE:', 5, yPos);
  doc.text(`R$ ${Math.max(0, newBalance).toFixed(2)}`, 65, yPos, { align: 'right' });
  yPos += 8;
  
  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Obrigado pelo pagamento!', 40, yPos, { align: 'center' });
  
  // Save PDF
  const fileName = `pagamento-${data.customer.name.replace(/\s+/g, '-')}-${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`;
  doc.save(fileName);
};