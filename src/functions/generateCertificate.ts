import chromium from "chrome-aws-lambda";
import { S3 } from "aws-sdk";
import path from 'path';
import fs from "fs";
import handlebars from 'handlebars';
import { document } from '../utils/dynamodbClient';
import dayjs from 'dayjs';

interface ICreateCertificate {
  id: string;
  name: string;
  grade: string;
}

interface ITemplate {
  id: string;
  name: string;
  grade: string;
  date: string;
  medal: string;
}

const compile = async function (data: ITemplate) {
  const filePath = path.join(
    process.cwd(),
    'src',
    'templates',
    'certificate.hbs'
  );

  const html = fs.readFileSync(filePath, 'utf-8');

  return handlebars.compile(html)(data);
}

export const handle = async (event) => {
  // receber os dados do evento
  const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;

  // salvar os dados na tabela do dynamoDB
  await document.put({
    TableName: 'users_certificates',
    Item: {
      id,
      name,
      grade
    }
  }).promise();

  // Pega o caminho do arquivo onde está localizado o medal
  // Lê o arquivo
  // Lê no formato base64 para poder ser usado no template
  // Porque o template espera uma imagem base64
  const medalPath = path.join(process.cwd(), "src", "templates", "selo.png");
  const medal = fs.readFileSync(medalPath, "base64");

  const data: ITemplate = {
    date: dayjs().format("DD/MM/YYYY"),
    grade,
    name,
    id,
    medal,
  };

  // Gera o certificado
  // Compilar usando handlebars
  const content = await compile(data);

  // Transformar em PDF
  const browser = await chromium.puppeteer.launch({
    headless: true,
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
  });

  // Cria uma página a partir do browser
  const page = await browser.newPage();

  // Passa 0 conteúdo para a págia
  await page.setContent(content);

  // Cria o conteúdo como PDF
  const pdf = await page.pdf({
    format: "a4",
    landscape: true,
    // Como não é possível rodar o chromium locamente,
    // Sendo que para isso a propriedade hadless no browser deve ser false
    // E o pdf precisa que ela seja true para gerar o pdf,
    // Então para certificar que estamos a gerar o certificado
    // Fazemos com que o mesmo seja gerado na raiz do projecto caso estejamos em ambiente local
    path: process.env.IS_OFFLINE ? "certificate.pdf" : null,

    // Força o browser a pegar o background definido nos styles
    printBackground: true,
    // Força o browser a pegar o tamanho da page definido no style
    preferCSSPageSize: true,
  });

  // Fecha o browser
  await browser.close();

  // Salvar no S3
  const s3 = new S3();

  await s3
    .putObject({
      Bucket: "serverlesscertificatesignite",
      Key: `${id}.pdf`,
      ACL: "public-read",
      Body: pdf,
      ContentType: "application/pdf",
    })
    .promise();

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: "Certificate created",
      url: `https://serverless-certificate-ignite-george.s3.amazonaws.com/${id}.pdf`,
    }),
    headres: {
      "Content-Type": "application/json"
    },
  };
};