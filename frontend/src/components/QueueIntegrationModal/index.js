import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Select,
  InputLabel,
  MenuItem,
  FormControl,
  TextField,
  Grid,
  Paper,
} from "@material-ui/core";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { logError, logInfo } from "../../utils/logger";
import { validateSgpConfig, SGP_PASSWORD_OPTIONS } from "../../utils/sgp";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },

  btnWrapper: {
    position: "relative",
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  btnLeft: {
    display: "flex",
    marginRight: "auto",
    marginLeft: 12,
  },
  colorAdorment: {
    width: 20,
    height: 20,
  },
}));

const DialogflowSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  // projectName: Yup.string()
  //   .min(3, "Too Short!")
  //   .max(100, "Too Long!")
  //   .required(),
  // jsonContent: Yup.string().min(3, "Too Short!").required(),
  // language: Yup.string().min(2, "Too Short!").max(50, "Too Long!").required(),
});

const stripGcKeysFromJson = (jsonContent) => {
  if (!jsonContent) return jsonContent;
  try {
    const parsed = JSON.parse(jsonContent);
    if (!parsed || typeof parsed !== "object") return jsonContent;
    delete parsed.gcAccessToken;
    delete parsed.gcSecretToken;
    delete parsed.gcBaseUrl;
    const keys = Object.keys(parsed);
    if (!keys.length) return "";
    return JSON.stringify(parsed);
  } catch (error) {
    return jsonContent;
  }
};

const QueueIntegration = ({ open, onClose, integrationId }) => {
  const classes = useStyles();

  const initialState = {
    type: "typebot",
    name: "",
    projectName: "",
    jsonContent: "",
    language: "",
    urlN8N: "",
    typebotDelayMessage: 1000,
    typebotExpires: 1,
    typebotKeywordFinish: "",
    typebotKeywordRestart: "",
    typebotRestartMessage: "",
    typebotSlug: "",
    typebotUnknownMessage: "",
    // SGP integration fields
    sgpIeSenha: "",
    sgpUrl: "",
    sgpWidePayToken: "",
    // Gestao Click integration fields
    gcAccessToken: "",
    gcSecretToken: "",
    gcBaseUrl: "",
    gcLastSyncAt: "",
    gcUpdatedCount: 0,
    gcLastError: "",
    gcTestNumber: ""
  };

  const [integration, setIntegration] = useState(initialState);

  useEffect(() => {
    (async () => {
      if (!integrationId) return;
      try {
        const { data } = await api.get(`/queueIntegration/${integrationId}`);
        let configFromJson = {};
        try {
          configFromJson = data?.jsonContent ? JSON.parse(data.jsonContent) : {};
        } catch (e) {
          logError("Falha ao parsear jsonContent da integração", e);
        }
        setIntegration((prevState) => ({
          ...prevState,
          ...data,
          jsonContent:
            data?.type === "gestaoclick"
              ? data.jsonContent
              : stripGcKeysFromJson(data.jsonContent),
          sgpIeSenha: configFromJson.sgpIeSenha || prevState.sgpIeSenha,
          sgpUrl: configFromJson.sgpUrl || prevState.sgpUrl,
          sgpWidePayToken: configFromJson.sgpWidePayToken || prevState.sgpWidePayToken,
          gcAccessToken: configFromJson.gcAccessToken || prevState.gcAccessToken,
          gcSecretToken: configFromJson.gcSecretToken || prevState.gcSecretToken,
          gcBaseUrl: configFromJson.gcBaseUrl || prevState.gcBaseUrl,
          gcLastSyncAt: data?.gcLastSyncAt || prevState.gcLastSyncAt,
          gcUpdatedCount:
            typeof data?.gcUpdatedCount === "number"
              ? data.gcUpdatedCount
              : prevState.gcUpdatedCount,
          gcLastError: data?.gcLastError || prevState.gcLastError
        }));
      } catch (err) {
        toastError(err);
      }
    })();

    return () => {
      setIntegration(initialState);
    };
  }, [integrationId, open]);

  const handleClose = () => {
    onClose();
    setIntegration(initialState);
  };

  const handleTestSession = async (event, values) => {
    try {
      const { projectName, jsonContent, language } = values;

      await api.post(`/queueIntegration/testSession`, {
        projectName,
        jsonContent,
        language,
      });

      toast.success(i18n.t("queueIntegrationModal.messages.testSuccess"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleSaveDialogflow = async (values) => {
    try {
      if (
        values.type === "n8n" ||
        values.type === "webhook" ||
        values.type === "typebot" ||
        values.type === "flowbuilder" ||
        values.type === "SGP" ||
        values.type === "gestaoclick"
      ) {
        values.projectName = values.name;
      }

      // Basic validation for SGP
      if (values.type === "SGP") {
        const errors = validateSgpConfig(values);
        if (errors.length) {
          errors.forEach((e) => toast.error(e));
          logError("Falha de validação SGP", { errors, values });
          return;
        }
        logInfo("Salvando integração SGP", { name: values.name });
      }
      if (values.type === "gestaoclick") {
        const errors = [];
        if (!values.name) errors.push("Nome da integração é obrigatório.");
        if (!values.gcAccessToken) errors.push("Access Token é obrigatório.");
        if (!values.gcSecretToken) errors.push("Secret Token é obrigatório.");
        if (errors.length) {
          errors.forEach((e) => toast.error(e));
          logError("Falha de validação Gestao Click", { errors, values });
          return;
        }
        logInfo("Salvando integração Gestao Click", { name: values.name });
      }
      // Persist SGP settings into jsonContent
      let payload = { ...values };
      if (values.type !== "gestaoclick") {
        const sanitized = stripGcKeysFromJson(values.jsonContent);
        if (sanitized !== values.jsonContent) {
          payload.jsonContent = sanitized;
        }
      }
      if (values.type === "SGP") {
        let baseJson = {};
        try {
          baseJson = values.jsonContent ? JSON.parse(values.jsonContent) : {};
        } catch {}
        const jsonContent = {
          ...baseJson,
          sgpIeSenha: values.sgpIeSenha,
          sgpUrl: values.sgpUrl,
          sgpWidePayToken: values.sgpWidePayToken,
        };
        payload = {
          ...values,
          jsonContent: JSON.stringify(jsonContent),
        };
        // Avoid sending unknown top-level attrs (backend model lacks columns)
        delete payload.sgpIeSenha;
        delete payload.sgpUrl;
        delete payload.sgpWidePayToken;
      }
      if (values.type === "gestaoclick") {
        let baseJson = {};
        try {
          baseJson = values.jsonContent ? JSON.parse(values.jsonContent) : {};
        } catch {}
        const jsonContent = {
          ...baseJson,
          gcAccessToken: values.gcAccessToken,
          gcSecretToken: values.gcSecretToken,
          gcBaseUrl: values.gcBaseUrl,
        };
        payload = {
          ...values,
          jsonContent: JSON.stringify(jsonContent),
        };
        delete payload.gcAccessToken;
        delete payload.gcSecretToken;
        delete payload.gcBaseUrl;
        delete payload.gcLastSyncAt;
        delete payload.gcUpdatedCount;
        delete payload.gcLastError;
        delete payload.gcTestNumber;
      }

      if (integrationId) {
        await api.put(`/queueIntegration/${integrationId}`, payload);
        toast.success(i18n.t("queueIntegrationModal.messages.editSuccess"));
      } else {
        await api.post("/queueIntegration", payload);
        toast.success(i18n.t("queueIntegrationModal.messages.addSuccess"));
      }
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  const handleTestGestaoClick = async (values) => {
    if (!integrationId) {
      toast.error(i18n.t("queueIntegrationModal.messages.gcSaveFirst"));
      return;
    }
    try {
      const { data } = await api.post(
        `/queueIntegration/${integrationId}/test-gestaoclick`,
        { testNumber: values.gcTestNumber }
      );
      const statusMsg = data?.message || i18n.t("queueIntegrationModal.messages.gcTestSuccess");
      if (data?.updated || data?.created) {
        toast.success(statusMsg);
      } else {
        toast.warning(statusMsg);
      }
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <DialogTitle>
          {integrationId
            ? `${i18n.t("queueIntegrationModal.title.edit")}`
            : `${i18n.t("queueIntegrationModal.title.add")}`}
        </DialogTitle>
        <Formik
          initialValues={integration}
          enableReinitialize={true}
          validationSchema={DialogflowSchema}
          onSubmit={(values, actions, event) => {
            setTimeout(() => {
              handleSaveDialogflow(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, values }) => (
            <Form>
              <Paper square className={classes.mainPaper} elevation={1}>
                <DialogContent dividers>
                  <Grid container spacing={1}>
                    <Grid item xs={12} md={6} xl={6}>
                      <FormControl
                        variant="outlined"
                        className={classes.formControl}
                        margin="dense"
                        fullWidth
                      >
                        <InputLabel id="type-selection-input-label">
                          {i18n.t("queueIntegrationModal.form.type")}
                        </InputLabel>

                        <Field
                          as={Select}
                          label={i18n.t("queueIntegrationModal.form.type")}
                          name="type"
                          labelId="profile-selection-label"
                          error={touched.type && Boolean(errors.type)}
                          helpertext={touched.type && errors.type}
                          id="type"
                          required
                        >
                          <MenuItem value="SGP">SGP</MenuItem>
                          <MenuItem value="gestaoclick">Gestao Click</MenuItem>
                          <MenuItem value="dialogflow">DialogFlow</MenuItem>
                          <MenuItem value="n8n">N8N</MenuItem>
                          <MenuItem value="webhook">WebHooks</MenuItem>
                          <MenuItem value="typebot">Typebot</MenuItem>
                          <MenuItem value="flowbuilder">Flowbuilder</MenuItem>
                        </Field>
                      </FormControl>
                    </Grid>
                    {values.type === "SGP" && (
                      <>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            name="name"
                            fullWidth
                            error={touched.name && Boolean(errors.name)}
                            helpertext={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <FormControl
                            variant="outlined"
                            className={classes.formControl}
                            margin="dense"
                            fullWidth
                          >
                            <InputLabel id="sgpIeSenha-selection-input-label">
                              Usuário Informa Senha
                            </InputLabel>

                            <Field
                              as={Select}
                              label="Usuário Informa Senha"
                              name="sgpIeSenha"
                              labelId="profile-selection-label"
                              fullWidth
                              error={touched.sgpIeSenha && Boolean(errors.sgpIeSenha)}
                              helpertext={touched.sgpIeSenha && errors.sgpIeSenha}
                              id="sgpIeSenha-selection"
                              required
                            >
                              {SGP_PASSWORD_OPTIONS.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                              ))}
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label="SGP URL"
                            name="sgpUrl"
                            error={touched.sgpUrl && Boolean(errors.sgpUrl)}
                            helpertext={touched.sgpUrl && errors.sgpUrl}
                            fullWidth
                            variant="outlined"
                            margin="dense"
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label="Widepay Token"
                            name="sgpWidePayToken"
                            error={touched.sgpWidePayToken && Boolean(errors.sgpWidePayToken)}
                            helpertext={touched.sgpWidePayToken && errors.sgpWidePayToken}
                            fullWidth
                            variant="outlined"
                            margin="dense"
                          />
                        </Grid>
                      </>
                    )}
                    {values.type === "gestaoclick" && (
                      <>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            name="name"
                            fullWidth
                            error={touched.name && Boolean(errors.name)}
                            helpertext={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.gcAccessToken")}
                            name="gcAccessToken"
                            error={touched.gcAccessToken && Boolean(errors.gcAccessToken)}
                            helpertext={touched.gcAccessToken && errors.gcAccessToken}
                            fullWidth
                            variant="outlined"
                            margin="dense"
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.gcSecretToken")}
                            name="gcSecretToken"
                            error={touched.gcSecretToken && Boolean(errors.gcSecretToken)}
                            helpertext={touched.gcSecretToken && errors.gcSecretToken}
                            fullWidth
                            variant="outlined"
                            margin="dense"
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.gcBaseUrl")}
                            name="gcBaseUrl"
                            error={touched.gcBaseUrl && Boolean(errors.gcBaseUrl)}
                            helpertext={touched.gcBaseUrl && errors.gcBaseUrl}
                            fullWidth
                            variant="outlined"
                            margin="dense"
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.gcTestNumber")}
                            name="gcTestNumber"
                            fullWidth
                            variant="outlined"
                            margin="dense"
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Button
                            onClick={() => handleTestGestaoClick(values)}
                            color="primary"
                            variant="outlined"
                            style={{ marginTop: 8 }}
                            disabled={!values.gcTestNumber}
                          >
                            {i18n.t("queueIntegrationModal.buttons.gcTest")}
                          </Button>
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <TextField
                            label={i18n.t("queueIntegrationModal.form.gcLastSyncAt")}
                            value={values.gcLastSyncAt || ""}
                            fullWidth
                            variant="outlined"
                            margin="dense"
                            InputProps={{ readOnly: true }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <TextField
                            label={i18n.t("queueIntegrationModal.form.gcUpdatedCount")}
                            value={values.gcUpdatedCount || 0}
                            fullWidth
                            variant="outlined"
                            margin="dense"
                            InputProps={{ readOnly: true }}
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12}>
                          <TextField
                            label={i18n.t("queueIntegrationModal.form.gcLastError")}
                            value={values.gcLastError || ""}
                            fullWidth
                            variant="outlined"
                            margin="dense"
                            InputProps={{ readOnly: true }}
                          />
                        </Grid>
                      </>
                    )}
                    {values.type === "dialogflow" && (
                      <>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            name="name"
                            fullWidth
                            error={touched.name && Boolean(errors.name)}
                            helpertext={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <FormControl
                            variant="outlined"
                            className={classes.formControl}
                            margin="dense"
                            fullWidth
                          >
                            <InputLabel id="language-selection-input-label">
                              {i18n.t("queueIntegrationModal.form.language")}
                            </InputLabel>

                            <Field
                              as={Select}
                              label={i18n.t(
                                "queueIntegrationModal.form.language"
                              )}
                              name="language"
                              labelId="profile-selection-label"
                              fullWidth
                              error={
                                touched.language && Boolean(errors.language)
                              }
                              helpertext={touched.language && errors.language}
                              id="language-selection"
                              required
                            >
                              <MenuItem value="pt-BR">Portugues</MenuItem>
                              <MenuItem value="en">Inglês</MenuItem>
                              <MenuItem value="es">Español</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t(
                              "queueIntegrationModal.form.projectName"
                            )}
                            name="projectName"
                            error={
                              touched.projectName && Boolean(errors.projectName)
                            }
                            helpertext={
                              touched.projectName && errors.projectName
                            }
                            fullWidth
                            variant="outlined"
                            margin="dense"
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12}>
                          <Field
                            as={TextField}
                            label={i18n.t(
                              "queueIntegrationModal.form.jsonContent"
                            )}
                            type="jsonContent"
                            multiline
                            //inputRef={greetingRef}
                            maxRows={5}
                            minRows={5}
                            fullWidth
                            name="jsonContent"
                            error={
                              touched.jsonContent && Boolean(errors.jsonContent)
                            }
                            helpertext={
                              touched.jsonContent && errors.jsonContent
                            }
                            variant="outlined"
                            margin="dense"
                          />
                        </Grid>
                      </>
                    )}

                    {(values.type === "n8n" || values.type === "webhook") && (
                      <>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            required
                            name="name"
                            error={touched.name && Boolean(errors.name)}
                            helpertext={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.urlN8N")}
                            name="urlN8N"
                            error={touched.urlN8N && Boolean(errors.urlN8N)}
                            helpertext={touched.urlN8N && errors.urlN8N}
                            variant="outlined"
                            margin="dense"
                            required
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                      </>
                    )}

                    {values.type === "flowbuilder" && (
                      <Grid item xs={12} md={6} xl={6}>
                        <Field
                          as={TextField}
                          label={i18n.t("queueIntegrationModal.form.name")}
                          autoFocus
                          name="name"
                          fullWidth
                          error={touched.name && Boolean(errors.name)}
                          helpertext={touched.name && errors.name}
                          variant="outlined"
                          margin="dense"
                          className={classes.textField}
                        />
                      </Grid>
                    )}

                    {values.type === "typebot" && (
                      <>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            name="name"
                            error={touched.name && Boolean(errors.name)}
                            helpertext={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            required
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.urlN8N")}
                            name="urlN8N"
                            error={touched.urlN8N && Boolean(errors.urlN8N)}
                            helpertext={touched.urlN8N && errors.urlN8N}
                            variant="outlined"
                            margin="dense"
                            required
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t(
                              "queueIntegrationModal.form.typebotSlug"
                            )}
                            name="typebotSlug"
                            error={
                              touched.typebotSlug && Boolean(errors.typebotSlug)
                            }
                            helpertext={
                              touched.typebotSlug && errors.typebotSlug
                            }
                            required
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t(
                              "queueIntegrationModal.form.typebotExpires"
                            )}
                            name="typebotExpires"
                            error={
                              touched.typebotExpires &&
                              Boolean(errors.typebotExpires)
                            }
                            helpertext={
                              touched.typebotExpires && errors.typebotExpires
                            }
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t(
                              "queueIntegrationModal.form.typebotDelayMessage"
                            )}
                            name="typebotDelayMessage"
                            error={
                              touched.typebotDelayMessage &&
                              Boolean(errors.typebotDelayMessage)
                            }
                            helpertext={
                              touched.typebotDelayMessage &&
                              errors.typebotDelayMessage
                            }
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t(
                              "queueIntegrationModal.form.typebotKeywordFinish"
                            )}
                            name="typebotKeywordFinish"
                            error={
                              touched.typebotKeywordFinish &&
                              Boolean(errors.typebotKeywordFinish)
                            }
                            helpertext={
                              touched.typebotKeywordFinish &&
                              errors.typebotKeywordFinish
                            }
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t(
                              "queueIntegrationModal.form.typebotKeywordRestart"
                            )}
                            name="typebotKeywordRestart"
                            error={
                              touched.typebotKeywordRestart &&
                              Boolean(errors.typebotKeywordRestart)
                            }
                            helpertext={
                              touched.typebotKeywordRestart &&
                              errors.typebotKeywordRestart
                            }
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t(
                              "queueIntegrationModal.form.typebotUnknownMessage"
                            )}
                            name="typebotUnknownMessage"
                            error={
                              touched.typebotUnknownMessage &&
                              Boolean(errors.typebotUnknownMessage)
                            }
                            helpertext={
                              touched.typebotUnknownMessage &&
                              errors.typebotUnknownMessage
                            }
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12}>
                          <Field
                            as={TextField}
                            label={i18n.t(
                              "queueIntegrationModal.form.typebotRestartMessage"
                            )}
                            name="typebotRestartMessage"
                            error={
                              touched.typebotRestartMessage &&
                              Boolean(errors.typebotRestartMessage)
                            }
                            helpertext={
                              touched.typebotRestartMessage &&
                              errors.typebotRestartMessage
                            }
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                      </>
                    )}
                  </Grid>
                </DialogContent>
              </Paper>

              <DialogActions>
                {values.type === "dialogflow" && (
                  <Button
                    //type="submit"
                    onClick={(e) => handleTestSession(e, values)}
                    color="inherit"
                    disabled={isSubmitting}
                    name="testSession"
                    variant="outlined"
                    className={classes.btnLeft}
                  >
                    {i18n.t("queueIntegrationModal.buttons.test")}
                  </Button>
                )}
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("queueIntegrationModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {integrationId
                    ? `${i18n.t("queueIntegrationModal.buttons.okEdit")}`
                    : `${i18n.t("queueIntegrationModal.buttons.okAdd")}`}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default QueueIntegration;

