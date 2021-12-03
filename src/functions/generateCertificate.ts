import { document } from '../utils/dynamodbClient';

interface ICreateCertificate {
  id: string;
  name: string;
  grade: string;
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

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: "Certificate created"
    }),
    headres: {
      "Content-Type": "application/json"
    },
  };
};