import { AttributeIds, BrowseResult, DataType, DataValue, OPCUAClient, ReferenceDescription, StatusCodes, TimestampsToReturn } from "node-opcua";

(async function() {
  try {
    const nodeId: string = 'ns=1;s=Temperature';
    const endpoint: string = 'opc.tcp://localhost:26543';

    const client = OPCUAClient.create({
      endpointMustExist: true,
      connectionStrategy: {
        maxRetry: 2,
        initialDelay: 2000,
        maxDelay: 10 * 1000
      }
    })

    client.on("backoff", () => console.log("retrying connection"));

    await client.connect(endpoint);

    const session = await client.createSession();

    // Example 1. Show what the items available inside folders are
    const browseResult: BrowseResult = await session.browse("ObjectsFolder") as BrowseResult;
    console.log(browseResult.references?.map((r: ReferenceDescription) => r.browseName.toString()).join("\n"));
    console.log('*****************************************Example 1****************************************************')

    // Example 2. Show the Value without monitored the properties
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
    if (dataValue.statusCode !== StatusCodes.Good) {
        console.log("Could not read ", nodeId);
    }
    console.log(` temperature = ${dataValue.value.toString()}`);
    console.log('*****************************************Example 2****************************************************')

    // Create Subscription
    const subscription = await  session.createSubscription2({
        requestedPublishingInterval: 1000,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 20,
        maxNotificationsPerPublish: 10,
        publishingEnabled: true,
        priority: 10
    });

    subscription
        .on("started", () => console.log("subscription started - subscriptionId=", subscription.subscriptionId))
        .on("keepalive", () => console.log("keepalive"))
        .on("terminated", () => console.log("subscription terminated"));

    // Example 3. Show the Value with monitoring
    const monitoredItem = await subscription.monitor({
        nodeId,
        attributeId: AttributeIds.Value
    },
        {
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 10
        }, TimestampsToReturn.Both);


    monitoredItem.on("changed", (dataValue: DataValue) => {
        console.log(` Temperature = ${dataValue.value.value.toString()}`)
    });
    
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await subscription.terminate();
    console.log('*****************************************Example 3****************************************************')

    // Example 4. Try to write some data
    const statusCode = await session.write({
      nodeId: "ns=1;i=1001",
      attributeId: AttributeIds.Value,
      value: {
          statusCode: StatusCodes.Good,
          sourceTimestamp: new Date(),
          value: {
              dataType: DataType.String,
              value: 'Change of the Data!'
          }
      }
    });
    console.log("statusCode = ", statusCode.toString());
    console.log('*****************************************Example 4****************************************************')

    // Close the session
    console.log(" closing session");
    await session.close();

    await client.disconnect();
    
  } catch (error) {
    console.log("Error !!!", error);
  }
})();