import React, { useState, useEffect } from "react";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { InvokeCommand, LambdaClient, LogType } from "@aws-sdk/client-lambda";
import { TextInput } from "../components/TextInput";
import { FileInput } from "../components/FileInput";
import { SubmitButton } from "../components/SubmitButton";
import { ResultDisplay } from "../components/ResultDisplay";
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../amplify/data/resource'
import { Amplify } from 'aws-amplify';
import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);

const client = generateClient<Schema>();

const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID || '';
const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '';

const s3Client = new S3Client({
  region: "ap-southeast-1",
  credentials: { accessKeyId, secretAccessKey },
});

const lambdaClient = new LambdaClient({
  region: "ap-southeast-1",
  credentials: { accessKeyId, secretAccessKey },
});

interface FormState {
  companyName: string;
  productName: string;
  ppgSensorModel: string;
  file: File | null;
}

interface LambdaResult {
  success_percentage: number;
  errors: {
    [key: string]: {
      signal_message: string;
    };
  };
}

const getFormattedTimestamp = () => {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const App: React.FC = () => {
  const [state, setState] = useState<FormState>({
    companyName: "",
    productName: "",
    ppgSensorModel: "",
    file: null,
  });
  const [result, setResult] = useState<LambdaResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, files } = event.target;
    const newState = files
      ? { ...state, file: files[0] }
      : { ...state, [id]: value };
    setState(newState);
  };

  useEffect(() => {
    console.log(state);
  }, [state]);

  const invokeLambda = async (funcName: string, payload: any) => {
    const stringifiedPayload = JSON.stringify(payload);
    const command = new InvokeCommand({
      FunctionName: funcName,
      Payload: new TextEncoder().encode(stringifiedPayload),
      LogType: LogType.Tail,
    });

    const { Payload, LogResult } = await lambdaClient.send(command);

    const textDecoder = new TextDecoder("utf-8");
    const result = JSON.parse(textDecoder.decode(Payload));
    const logs = textDecoder.decode(
      Uint8Array.from(atob(LogResult || ""), (c) => c.charCodeAt(0))
    );

    console.log("Lambda logs:", logs);
    return result;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!state.file) {
      return;
    }

    setLoading(true);

    try {
      // check if company exists
      const { data: infos, errors } = await client.models.Info.list({
        filter: {
          companyName: {
            eq: state.companyName
          }
        }
      });
      if (errors) {
        console.error(errors);
      } 
      const info = infos.length > 0 ? infos[0] : null;

      // Create data on company
      if (!info) {
        await client.models.Info.create({
          companyName: state.companyName,
          productName: state.productName,
          ppgSensorModel: state.ppgSensorModel
        })
      } 

      const timestamp = getFormattedTimestamp()
      const fileKey = `${state.companyName}/${state.productName}/${state.productName}/${state.file.name}_${timestamp}`
      
      // Upload file to S3 using AWS SDK
      const command = new PutObjectCommand({
        Bucket: "signal-quality-check-test",
        Key: fileKey,
        Body: state.file,
        ContentType: state.file.type,
      });

      const response = await s3Client.send(command);

      if (response.$metadata.httpStatusCode === 200) {
        console.log("File uploaded successfully");

        // Invoke Lambda function
        const payload = {
          key: state.file.name,
          companyName: state.companyName,
          productName: state.productName,
          ppgSensorModel: state.ppgSensorModel,
        };

        const lambdaResult = await invokeLambda(
          "signal-quality-check",
          payload
        );
        setResult(lambdaResult);
        alert("Lambda invoked successfully!");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to upload file or invoke Lambda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto max-w-2xl p-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 shadow-md rounded px-8 pt-6 pb-8 mb-4"
      >
        <TextInput
          id="companyName"
          label="Company Name:"
          value={state.companyName}
          onChange={handleInputChange}
          labelStyles="block mb-2 font-bold text-sm text-gray-700"
          inputStyles="w-full p-2 text-sm border rounded border-gray-300"
        />
        <TextInput
          id="productName"
          label="Product Name/Model:"
          value={state.productName}
          onChange={handleInputChange}
          labelStyles="block mb-2 font-bold text-sm text-gray-700"
          inputStyles="w-full p-2 text-sm border rounded border-gray-300"
        />
        <TextInput
          id="ppgSensorModel"
          label="PPG Sensor Model:"
          value={state.ppgSensorModel}
          onChange={handleInputChange}
          labelStyles="block mb-2 font-bold text-sm text-gray-700"
          inputStyles="w-full p-2 text-sm border rounded border-gray-300"
        />
        <FileInput
          id="file"
          label="Upload PPG data CSV files (.zip):"
          onChange={handleInputChange}
          accept=".zip"
          labelStyles="mr-4"
          inputStyles="mt-3"
        />
        <SubmitButton 
          label="Submit" 
          styles="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        />
      </form>
      {loading && (
        <div className="text-center">
          <p className="text-blue-500">Processing...</p>
        </div>
      )}
      <ResultDisplay result={result} />
    </main>
  );
};

export default App;
