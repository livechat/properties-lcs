import { useEffect, useRef, useState } from "react";
import { createDetailsWidget } from "@livechat/agent-app-sdk";
import { Button } from "@livechat/design-system";
import AccountsSDK from "@livechat/accounts-sdk";

const CLIENT_ID = "YOUR_CLIENT_ID"; // Client_ID from Authorization Block
const accountsOptions = {
  client_id: CLIENT_ID, // Client_ID from Authorization Block
  redirect_uri: "https://localhost:3000",
  prompt: "consent",
};

const instance = new AccountsSDK(accountsOptions); // AccountsSDK

const Widget = () => {
  const widget = useRef(null);
  const [profile, setProfile] = useState(null);
  const [authorizeData, setAuthorizeData] = useState(null);
  const [hasSubscription, setHasSubscription] = useState(false);

  const getWidget = async () => {
    widget.current = await createDetailsWidget();

    widget.current.on("customer_profile", async (profile) => {
      console.log("profile", profile);
      setProfile(profile);
    });
  };

  const getProperties = async (authorizeData) => {
    // Get list of license properties to check if there are any existing subscriptions
    return await fetch(
      "https://api.livechatinc.com/v3.4/configuration/action/list_license_properties",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authorizeData.access_token}`,
        },
        body: JSON.stringify({
          namespace: CLIENT_ID,
        }),
      }
    ).then(async (response) => {
      const existingProperties = await response.json();
      console.log("existingProperties", existingProperties);
      if (existingProperties[CLIENT_ID]) {
        const existingSubscriptionsRaw =
          existingProperties[CLIENT_ID].Subscriptions;
        const existingSubscriptions = existingSubscriptionsRaw
          ? JSON.parse(existingSubscriptionsRaw)
          : [];
        return existingSubscriptions;
      }
      return "";
    });
  };

  useEffect(() => {
    getWidget();
  }, []);

  useEffect(() => {
    const checkSubscription = async () => {
      if (profile?.id && authorizeData) {
        console.log("check for subscription");
        const subscriptionProps = await getProperties(authorizeData);
        if (subscriptionProps.includes(profile.id)) {
          setHasSubscription(true);
        } else {
          setHasSubscription(false);
        }
      }
    };

    checkSubscription();
  }, [profile?.id, authorizeData]);

  const saveProperties = async (updatedSubscriptions) => {
    // Post request to Configuration API with the updated list of subscriptions
    await fetch(
      "https://api.livechatinc.com/v3.4/configuration/action/update_license_properties",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authorizeData.access_token}`,
        },
        body: JSON.stringify({
          properties: {
            [CLIENT_ID]: {
              Subscriptions: JSON.stringify(updatedSubscriptions),
            },
          },
        }),
      }
    );
  };

  const handleSubscribe = async () => {
    const existingSubscriptions = await getProperties(authorizeData);

    if (existingSubscriptions.includes(profile.id)) {
      return;
    }

    const updatedSubscriptions = [...existingSubscriptions, profile.id];

    try {
      await saveProperties(updatedSubscriptions);
      setHasSubscription(true);
    } catch {}
  };

  const handleUnsubscribe = async () => {
    const existingSubscriptions = await getProperties(authorizeData);
    const updatedSubscriptions = existingSubscriptions.filter(
      (profileId) => profileId !== profile.id
    );

    try {
      await saveProperties(updatedSubscriptions);
      setHasSubscription(false);
    } catch {}
  };

  const handleLogin = () => {
    const redirect = instance.redirect({
      state: JSON.stringify(profile),
    });

    redirect
      .authorizeData()
      .then(async (authorizeData) => {
        setAuthorizeData(authorizeData);

        const { state } = authorizeData;

        console.log("state", state);
        const stateProfile = JSON.parse(state);

        setProfile(stateProfile);

        const subscriptionProps = await getProperties(authorizeData);
        console.log(subscriptionProps);

        if (subscriptionProps.includes(stateProfile.id)) {
          setHasSubscription(true);
        }
      })
      .catch((e) => {
        console.log(e);
        redirect.authorize(); // Try to redirect user to authorization once more
      });
  };

  return (
    <div>
      {!authorizeData && (
        <Button kind="primary" onClick={handleLogin}>
          Login
        </Button>
      )}

      {authorizeData && (
        <div>
          <p>Customer name: {profile?.name || "unknown"}</p>
          <p>Customer email: {profile?.email || "unknown"}</p>

          {hasSubscription ? (
            <div>
              <p>Subscription active</p>
              <Button kind="destructive" onClick={handleUnsubscribe}>
                Unsubscribe
              </Button>
            </div>
          ) : (
            <Button kind="primary" onClick={handleSubscribe}>
              Add Subscription
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Widget;
