{{- define "premortem.name" -}}
premortem
{{- end -}}

{{- define "premortem.fullname" -}}
{{- printf "%s" (include "premortem.name" .) -}}
{{- end -}}

{{- define "premortem.labels" -}}
app.kubernetes.io/name: {{ include "premortem.name" . }}
app.kubernetes.io/part-of: premortem
app.kubernetes.io/managed-by: Helm
{{- end -}}

{{- define "premortem.selectorLabels" -}}
app.kubernetes.io/name: {{ include "premortem.name" . }}
{{- end -}}
