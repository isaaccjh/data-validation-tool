import React, { useState, useEffect, useMemo } from "react";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { InvokeCommand, LambdaClient, LogType } from "@aws-sdk/client-lambda";
import { TextInput } from "../components/TextInput";
import { FileInput } from "../components/FileInput";
import { SubmitButton } from "../components/SubmitButton";
import { ResultDisplay } from "../components/ResultDisplay";
import { SelectWithInput } from "../components/SelectWithInput";
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../amplify/data/resource';
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
  const month = String(now.getMonth() + 1).padStart(2, '0');
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
  const [companyOptions, setCompanyOptions] = useState<string[]>([]);
  const [sensorOptions, setSensorOptions] = useState<string[]>([]);

  const isCompanyInOptions = useMemo(() => {
    return companyOptions.includes(state.companyName);
  }, [companyOptions, state.companyName]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = event.target;
  
    if (event.target instanceof HTMLInputElement) {
      if (event.target.type === "file") {
        const files = event.target.files;
        if (files && files.length > 0) {
          setState((prevState) => ({ ...prevState, file: files[0] }));
        }
      } else {
        setState((prevState) => ({ ...prevState, [id]: value }));
      }
    } else if (event.target instanceof HTMLSelectElement) {
      setState((prevState) => ({ ...prevState, [id]: value }));
    }
  };

  useEffect(() => {
    console.log(state);
  }, [state]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data: infos, errors } = await client.models.Info.list({});
        if (errors) {
          console.error(errors);
        } else {
          const companies = [...new Set(infos.map((info: any) => info.companyName))];
          setCompanyOptions(companies);
        }
      } catch (error) {
        console.error("Error fetching companies:", error);
      }
    };

    fetchCompanies();
  }, []);

  const invokeLambda = async (funcName: string, payload: any) => {
    const stringifiedPayload = JSON.stringify(payload);
    console.log(payload)
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
      if (!companyOptions.includes(state.companyName)) {
        setCompanyOptions((prevOptions) => [...prevOptions, state.companyName]);
      }

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
      if (info && info.productName !==  state.productName) {
        await client.models.Info.create({
          companyName: state.companyName,
          productName: state.productName,
          ppgSensorModel: [state.ppgSensorModel]
        });
      }
      if (!info) {
        await client.models.Info.create({
          companyName: state.companyName,
          productName: state.productName,
          ppgSensorModel: [state.ppgSensorModel]
        });
      } else {
        // Update the existing info with the new PPG sensor model
        let existingSensors = info.ppgSensorModel;
        if (!Array.isArray(existingSensors)) {
          existingSensors = existingSensors ? [existingSensors] : [];
        }
        const updatedSensorModels = [...existingSensors, state.ppgSensorModel];
        const uniqueSensorModels = updatedSensorModels.filter((value, index, self) =>
          self.indexOf(value) === index
        );
        await client.models.Info.update({
          id: info.id,
          ppgSensorModel: uniqueSensorModels
        });
      }

      const fileKey = `${state.companyName}/${state.productName}/${state.file.name.split('.')[0]}.zip`;
      
      const command = new PutObjectCommand({
        Bucket: "signal-quality-check-test",
        Key: fileKey,
        Body: state.file,
        ContentType: state.file.type,
      });

      const response = await s3Client.send(command);

      if (response.$metadata.httpStatusCode === 200) {
        console.log("File uploaded successfully");

        const payload = {
          key: fileKey,
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

        // Clear the form after successful submission
        setState({
          companyName: "",
          productName: "",
          ppgSensorModel: "",
          file: null,
        });
        // Clear the file input
        const fileInput = document.getElementById('file') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to upload file or invoke Lambda.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSensors = async () => {
    if (!state.companyName) {
      alert("Please enter a company name first.");
      return;
    }

    setLoading(true);
    try {
      const { data: infos, errors } = await client.models.Info.list({
        filter: {
          companyName: {
            eq: state.companyName
          }
        }
      });

      if (errors) {
        console.error(errors);
        alert("Error fetching sensors.");
      } else {
        const allSensors = infos.flatMap((info: any) => {
          if (Array.isArray(info.ppgSensorModel)) {
            return info.ppgSensorModel.filter((sensor: string | null): sensor is string => sensor !== null);
          } else if (typeof info.ppgSensorModel === 'string') {
            return [info.ppgSensorModel];
          } else if (info.ppgSensorModel === null || info.ppgSensorModel === undefined) {
            return [];
          } else {
            return [String(info.ppgSensorModel)];
          }
        });
        
        const uniqueSensors = allSensors.filter((value, index, self) =>
          self.indexOf(value) === index
        );
        setSensorOptions(uniqueSensors);
        if (uniqueSensors.length > 0) {
          setState(prevState => ({ ...prevState, ppgSensorModel: "" }));
        } else {
          alert(`No sensors found for ${state.companyName}. You can add a new sensor model.`);
        }
      }
    } catch (error) {
      console.error("Error fetching sensors:", error);
      alert("Failed to fetch sensors.");
    } finally {
      setLoading(false);
    }
  };
  const styles = {
    "div": "bg-white shadow-md rounded-lg p-6 mt-6",
    "h2": "text-2xl font-bold mb-4",
    "h3": "text-xl font-semibold mb-2",
    "success": "text-green-600",
    "error": "text-red-600",
    "p": "text-lg font-semibold mb-4",
    "ul": "list-disc list-inside",
    "li": "mb-2",
    "signalMessage": "font-medium",
    "noErrors": "text-lg font-semibold text-green-600"
  }

  return (
    <main className="container mx-auto max-w-2xl p-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 shadow-md rounded px-8 pt-6 pb-8 mb-4"
      >
        <div className="flex flex-col space-y-2">
          <label htmlFor="companyName" className="block font-bold text-sm text-gray-700">
            Company Name:
          </label>
          <div className="flex space-x-4">
            <div className="flex-grow">
              <SelectWithInput
                id="companyName"
                label=""
                options={companyOptions}
                value={state.companyName}
                onChange={handleInputChange}
                labelStyles="sr-only"
                inputStyles="w-full p-2 text-sm border rounded border-gray-300"
              />
            </div>
            <button
              type="button"
              onClick={fetchSensors}
              disabled={!isCompanyInOptions}
              className={`text-white py-2 px-4 h-10 rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 whitespace-nowrap ${
                isCompanyInOptions
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              Fetch Sensors
            </button>
          </div>
        </div>
        <TextInput
          id="productName"
          label="Product Name/Model:"
          value={state.productName}
          onChange={handleInputChange}
          labelStyles="block mb-2 font-bold text-sm text-gray-700"
          inputStyles="w-full p-2 text-sm border rounded border-gray-300"
        />
        <div className="flex flex-col space-y-2">
          <label htmlFor="ppgSensorModel" className="block font-bold text-sm text-gray-700">
            PPG Sensor Model:
          </label>
          <SelectWithInput
            id="ppgSensorModel"
            label=""
            options={sensorOptions}
            value={state.ppgSensorModel}
            onChange={handleInputChange}
            labelStyles="sr-only"
            inputStyles="w-full p-2 text-sm border rounded border-gray-300"
          />
        </div>
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
      <ResultDisplay result={result} styles={styles} />
    </main>
  );
};

export default App;