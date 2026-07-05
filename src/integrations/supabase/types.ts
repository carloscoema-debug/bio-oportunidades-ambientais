export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          atualizado_em: string
          chave: string
          valor: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      areas_tematicas: {
        Row: {
          ativo: boolean
          descricao: string | null
          id: string
          label_display: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          descricao?: string | null
          id?: string
          label_display: string
          nome: string
        }
        Update: {
          ativo?: boolean
          descricao?: string | null
          id?: string
          label_display?: string
          nome?: string
        }
        Relationships: []
      }
      assinantes_email: {
        Row: {
          ativo: boolean
          data_cadastro: string
          email: string
          finalidade_declarada: string | null
          id: string
          timestamp_consentimento: string
          token_optout: string
          versao_termo_lgpd: string
        }
        Insert: {
          ativo?: boolean
          data_cadastro?: string
          email: string
          finalidade_declarada?: string | null
          id?: string
          timestamp_consentimento?: string
          token_optout?: string
          versao_termo_lgpd: string
        }
        Update: {
          ativo?: boolean
          data_cadastro?: string
          email?: string
          finalidade_declarada?: string | null
          id?: string
          timestamp_consentimento?: string
          token_optout?: string
          versao_termo_lgpd?: string
        }
        Relationships: []
      }
      emails_recebidos: {
        Row: {
          assunto: string | null
          corpo_raw: string | null
          created_at: string
          fonte_id: string | null
          id: string
          remetente: string | null
          status_parsing: Database["public"]["Enums"]["email_status"]
          vagas_geradas: number
        }
        Insert: {
          assunto?: string | null
          corpo_raw?: string | null
          created_at?: string
          fonte_id?: string | null
          id?: string
          remetente?: string | null
          status_parsing?: Database["public"]["Enums"]["email_status"]
          vagas_geradas?: number
        }
        Update: {
          assunto?: string | null
          corpo_raw?: string | null
          created_at?: string
          fonte_id?: string | null
          id?: string
          remetente?: string | null
          status_parsing?: Database["public"]["Enums"]["email_status"]
          vagas_geradas?: number
        }
        Relationships: [
          {
            foreignKeyName: "emails_recebidos_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "fontes_coleta"
            referencedColumns: ["id"]
          },
        ]
      }
      execucoes_coleta: {
        Row: {
          fim: string | null
          fonte_id: string | null
          id: string
          inicio: string
          itens_duplicados: number | null
          itens_encontrados: number | null
          itens_erro: number | null
          itens_novos: number | null
          mensagem_erro: string | null
          status: Database["public"]["Enums"]["execucao_status"] | null
        }
        Insert: {
          fim?: string | null
          fonte_id?: string | null
          id?: string
          inicio?: string
          itens_duplicados?: number | null
          itens_encontrados?: number | null
          itens_erro?: number | null
          itens_novos?: number | null
          mensagem_erro?: string | null
          status?: Database["public"]["Enums"]["execucao_status"] | null
        }
        Update: {
          fim?: string | null
          fonte_id?: string | null
          id?: string
          inicio?: string
          itens_duplicados?: number | null
          itens_encontrados?: number | null
          itens_erro?: number | null
          itens_novos?: number | null
          mensagem_erro?: string | null
          status?: Database["public"]["Enums"]["execucao_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "execucoes_coleta_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "fontes_coleta"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks_vagas: {
        Row: {
          created_at: string
          id: string
          ip_hash: string | null
          status_validacao: Database["public"]["Enums"]["feedback_validacao"]
          tipo_feedback: Database["public"]["Enums"]["feedback_tipo"]
          token_anonimo: string
          user_agent_hash: string | null
          vaga_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          status_validacao?: Database["public"]["Enums"]["feedback_validacao"]
          tipo_feedback: Database["public"]["Enums"]["feedback_tipo"]
          token_anonimo: string
          user_agent_hash?: string | null
          vaga_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          status_validacao?: Database["public"]["Enums"]["feedback_validacao"]
          tipo_feedback?: Database["public"]["Enums"]["feedback_tipo"]
          token_anonimo?: string
          user_agent_hash?: string | null
          vaga_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_vagas_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_vagas_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      fontes_coleta: {
        Row: {
          canal: Database["public"]["Enums"]["fonte_canal"]
          created_at: string
          falhas_consecutivas: number
          id: string
          metodo_coleta: Database["public"]["Enums"]["fonte_metodo"]
          nome: string
          padrao_remetente: string | null
          score_confiabilidade: number
          status: Database["public"]["Enums"]["fonte_status"]
          taxa_aproveitamento: number
          tipo: Database["public"]["Enums"]["fonte_tipo"]
          ultima_execucao: string | null
          url: string | null
        }
        Insert: {
          canal: Database["public"]["Enums"]["fonte_canal"]
          created_at?: string
          falhas_consecutivas?: number
          id?: string
          metodo_coleta: Database["public"]["Enums"]["fonte_metodo"]
          nome: string
          padrao_remetente?: string | null
          score_confiabilidade?: number
          status?: Database["public"]["Enums"]["fonte_status"]
          taxa_aproveitamento?: number
          tipo: Database["public"]["Enums"]["fonte_tipo"]
          ultima_execucao?: string | null
          url?: string | null
        }
        Update: {
          canal?: Database["public"]["Enums"]["fonte_canal"]
          created_at?: string
          falhas_consecutivas?: number
          id?: string
          metodo_coleta?: Database["public"]["Enums"]["fonte_metodo"]
          nome?: string
          padrao_remetente?: string | null
          score_confiabilidade?: number
          status?: Database["public"]["Enums"]["fonte_status"]
          taxa_aproveitamento?: number
          tipo?: Database["public"]["Enums"]["fonte_tipo"]
          ultima_execucao?: string | null
          url?: string | null
        }
        Relationships: []
      }
      insercoes_profissionais: {
        Row: {
          created_at: string
          data_inicio: string | null
          empresa_orgao: string | null
          id: string
          matricula_estudante: string | null
          nome_estudante: string | null
          observacoes: string | null
          origem_registro: Database["public"]["Enums"]["origem_registro"]
          tipo_vinculo: Database["public"]["Enums"]["tipo_vinculo"] | null
          vaga_id: string | null
        }
        Insert: {
          created_at?: string
          data_inicio?: string | null
          empresa_orgao?: string | null
          id?: string
          matricula_estudante?: string | null
          nome_estudante?: string | null
          observacoes?: string | null
          origem_registro?: Database["public"]["Enums"]["origem_registro"]
          tipo_vinculo?: Database["public"]["Enums"]["tipo_vinculo"] | null
          vaga_id?: string | null
        }
        Update: {
          created_at?: string
          data_inicio?: string | null
          empresa_orgao?: string | null
          id?: string
          matricula_estudante?: string | null
          nome_estudante?: string | null
          observacoes?: string | null
          origem_registro?: Database["public"]["Enums"]["origem_registro"]
          tipo_vinculo?: Database["public"]["Enums"]["tipo_vinculo"] | null
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insercoes_profissionais_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insercoes_profissionais_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      lista_negra_hashes: {
        Row: {
          bloqueio_permanente: boolean
          created_at: string
          data_expiracao: string | null
          hash_semantico: string
          id: string
          motivo: string | null
        }
        Insert: {
          bloqueio_permanente?: boolean
          created_at?: string
          data_expiracao?: string | null
          hash_semantico: string
          id?: string
          motivo?: string | null
        }
        Update: {
          bloqueio_permanente?: boolean
          created_at?: string
          data_expiracao?: string | null
          hash_semantico?: string
          id?: string
          motivo?: string | null
        }
        Relationships: []
      }
      logs_auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          id: string
          registro_id: string | null
          tabela_afetada: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          registro_id?: string | null
          tabela_afetada?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          registro_id?: string | null
          tabela_afetada?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_auditoria_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      municipios_referencia: {
        Row: {
          ativo: boolean
          municipio: string
          regiao_bio: Database["public"]["Enums"]["regiao_bio"]
          uf: string
        }
        Insert: {
          ativo?: boolean
          municipio: string
          regiao_bio: Database["public"]["Enums"]["regiao_bio"]
          uf?: string
        }
        Update: {
          ativo?: boolean
          municipio?: string
          regiao_bio?: Database["public"]["Enums"]["regiao_bio"]
          uf?: string
        }
        Relationships: []
      }
      notificacoes_enviadas: {
        Row: {
          assunto: string | null
          data_envio: string
          id: string
          mensagem_erro: string | null
          status_envio: Database["public"]["Enums"]["notificacao_status"] | null
          total_destinatarios: number | null
          vagas_incluidas: string[] | null
        }
        Insert: {
          assunto?: string | null
          data_envio?: string
          id?: string
          mensagem_erro?: string | null
          status_envio?:
            | Database["public"]["Enums"]["notificacao_status"]
            | null
          total_destinatarios?: number | null
          vagas_incluidas?: string[] | null
        }
        Update: {
          assunto?: string | null
          data_envio?: string
          id?: string
          mensagem_erro?: string | null
          status_envio?:
            | Database["public"]["Enums"]["notificacao_status"]
            | null
          total_destinatarios?: number | null
          vagas_incluidas?: string[] | null
        }
        Relationships: []
      }
      parceiros: {
        Row: {
          area_atuacao: string | null
          ativo: boolean
          cnpj: string | null
          cnpj_verificado: boolean
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          criterio_parceiro_atendido: boolean
          data_verificacao_cnpj: string | null
          fonte_verificacao: string | null
          id: string
          municipio: string | null
          nome: string
          observacoes: string | null
          tipo: Database["public"]["Enums"]["parceiro_tipo"] | null
        }
        Insert: {
          area_atuacao?: string | null
          ativo?: boolean
          cnpj?: string | null
          cnpj_verificado?: boolean
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          criterio_parceiro_atendido?: boolean
          data_verificacao_cnpj?: string | null
          fonte_verificacao?: string | null
          id?: string
          municipio?: string | null
          nome: string
          observacoes?: string | null
          tipo?: Database["public"]["Enums"]["parceiro_tipo"] | null
        }
        Update: {
          area_atuacao?: string | null
          ativo?: boolean
          cnpj?: string | null
          cnpj_verificado?: boolean
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          criterio_parceiro_atendido?: boolean
          data_verificacao_cnpj?: string | null
          fonte_verificacao?: string | null
          id?: string
          municipio?: string | null
          nome?: string
          observacoes?: string | null
          tipo?: Database["public"]["Enums"]["parceiro_tipo"] | null
        }
        Relationships: [
          {
            foreignKeyName: "parceiros_municipio_fkey"
            columns: ["municipio"]
            isOneToOne: false
            referencedRelation: "municipios_referencia"
            referencedColumns: ["municipio"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["profile_role"]
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
        }
        Relationships: []
      }
      vagas: {
        Row: {
          area_tematica_id: string | null
          atividades: string | null
          carga_horaria: string | null
          checklist_publicacao: Json
          contagem_cliques: number
          contato_submissao: string | null
          count_link_invalido: number
          count_me_candidatei: number
          count_vaga_encerrada: number
          count_vaga_suspeita: number
          curso_alvo: string[]
          data_captura: string
          data_envio_newsletter: string | null
          data_expiracao_calculada: string | null
          data_publicacao: string | null
          data_revisao_origem_externa: string | null
          data_ultima_verificacao_link: string | null
          descricao: string | null
          empresa_orgao: string | null
          flags_incompatibilidade: Json
          fonte_id: string | null
          forma_candidatura: string | null
          id: string
          ip_hash_submissao: string | null
          link_candidatura: string | null
          link_falhas_consecutivas: number
          localizacao_original: string | null
          mensagem_verificacao_link: string | null
          modalidade: Database["public"]["Enums"]["vaga_modalidade"] | null
          motivo_rejeicao_categoria:
            | Database["public"]["Enums"]["motivo_rejeicao"]
            | null
          motivo_rejeicao_detalhe: string | null
          municipio: string | null
          natureza_processo: Database["public"]["Enums"]["natureza_processo"]
          nivel: Database["public"]["Enums"]["vaga_nivel"]
          origem: string | null
          origem_externa_nao_verificada: boolean
          parceiro_id: string | null
          prazo_inscricao: string | null
          regiao: Database["public"]["Enums"]["vaga_regiao"]
          remuneracao_bolsa: string | null
          requisitos: string | null
          revisado_por: string | null
          revisao_manual_origem_externa: boolean
          score_aderencia: number
          score_confiabilidade_fonte: number
          score_urgencia: number
          score_versao: string
          sem_prazo_definido: boolean
          setor: Database["public"]["Enums"]["vaga_setor"] | null
          status: Database["public"]["Enums"]["vaga_status"]
          status_link: Database["public"]["Enums"]["status_link"]
          subtipo_estagio: Database["public"]["Enums"]["subtipo_estagio"]
          tipo: Database["public"]["Enums"]["vaga_tipo"]
          titulo: string
          vaga_bruta_id: string | null
        }
        Insert: {
          area_tematica_id?: string | null
          atividades?: string | null
          carga_horaria?: string | null
          checklist_publicacao?: Json
          contagem_cliques?: number
          contato_submissao?: string | null
          count_link_invalido?: number
          count_me_candidatei?: number
          count_vaga_encerrada?: number
          count_vaga_suspeita?: number
          curso_alvo?: string[]
          data_captura?: string
          data_envio_newsletter?: string | null
          data_expiracao_calculada?: string | null
          data_publicacao?: string | null
          data_revisao_origem_externa?: string | null
          data_ultima_verificacao_link?: string | null
          descricao?: string | null
          empresa_orgao?: string | null
          flags_incompatibilidade?: Json
          fonte_id?: string | null
          forma_candidatura?: string | null
          id?: string
          ip_hash_submissao?: string | null
          link_candidatura?: string | null
          link_falhas_consecutivas?: number
          localizacao_original?: string | null
          mensagem_verificacao_link?: string | null
          modalidade?: Database["public"]["Enums"]["vaga_modalidade"] | null
          motivo_rejeicao_categoria?:
            | Database["public"]["Enums"]["motivo_rejeicao"]
            | null
          motivo_rejeicao_detalhe?: string | null
          municipio?: string | null
          natureza_processo?: Database["public"]["Enums"]["natureza_processo"]
          nivel?: Database["public"]["Enums"]["vaga_nivel"]
          origem?: string | null
          origem_externa_nao_verificada?: boolean
          parceiro_id?: string | null
          prazo_inscricao?: string | null
          regiao?: Database["public"]["Enums"]["vaga_regiao"]
          remuneracao_bolsa?: string | null
          requisitos?: string | null
          revisado_por?: string | null
          revisao_manual_origem_externa?: boolean
          score_aderencia?: number
          score_confiabilidade_fonte?: number
          score_urgencia?: number
          score_versao?: string
          sem_prazo_definido?: boolean
          setor?: Database["public"]["Enums"]["vaga_setor"] | null
          status?: Database["public"]["Enums"]["vaga_status"]
          status_link?: Database["public"]["Enums"]["status_link"]
          subtipo_estagio?: Database["public"]["Enums"]["subtipo_estagio"]
          tipo: Database["public"]["Enums"]["vaga_tipo"]
          titulo: string
          vaga_bruta_id?: string | null
        }
        Update: {
          area_tematica_id?: string | null
          atividades?: string | null
          carga_horaria?: string | null
          checklist_publicacao?: Json
          contagem_cliques?: number
          contato_submissao?: string | null
          count_link_invalido?: number
          count_me_candidatei?: number
          count_vaga_encerrada?: number
          count_vaga_suspeita?: number
          curso_alvo?: string[]
          data_captura?: string
          data_envio_newsletter?: string | null
          data_expiracao_calculada?: string | null
          data_publicacao?: string | null
          data_revisao_origem_externa?: string | null
          data_ultima_verificacao_link?: string | null
          descricao?: string | null
          empresa_orgao?: string | null
          flags_incompatibilidade?: Json
          fonte_id?: string | null
          forma_candidatura?: string | null
          id?: string
          ip_hash_submissao?: string | null
          link_candidatura?: string | null
          link_falhas_consecutivas?: number
          localizacao_original?: string | null
          mensagem_verificacao_link?: string | null
          modalidade?: Database["public"]["Enums"]["vaga_modalidade"] | null
          motivo_rejeicao_categoria?:
            | Database["public"]["Enums"]["motivo_rejeicao"]
            | null
          motivo_rejeicao_detalhe?: string | null
          municipio?: string | null
          natureza_processo?: Database["public"]["Enums"]["natureza_processo"]
          nivel?: Database["public"]["Enums"]["vaga_nivel"]
          origem?: string | null
          origem_externa_nao_verificada?: boolean
          parceiro_id?: string | null
          prazo_inscricao?: string | null
          regiao?: Database["public"]["Enums"]["vaga_regiao"]
          remuneracao_bolsa?: string | null
          requisitos?: string | null
          revisado_por?: string | null
          revisao_manual_origem_externa?: boolean
          score_aderencia?: number
          score_confiabilidade_fonte?: number
          score_urgencia?: number
          score_versao?: string
          sem_prazo_definido?: boolean
          setor?: Database["public"]["Enums"]["vaga_setor"] | null
          status?: Database["public"]["Enums"]["vaga_status"]
          status_link?: Database["public"]["Enums"]["status_link"]
          subtipo_estagio?: Database["public"]["Enums"]["subtipo_estagio"]
          tipo?: Database["public"]["Enums"]["vaga_tipo"]
          titulo?: string
          vaga_bruta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vagas_area_tematica_id_fkey"
            columns: ["area_tematica_id"]
            isOneToOne: false
            referencedRelation: "areas_tematicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "fontes_coleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_vaga_bruta_id_fkey"
            columns: ["vaga_bruta_id"]
            isOneToOne: false
            referencedRelation: "vagas_brutas"
            referencedColumns: ["id"]
          },
        ]
      }
      vagas_brutas: {
        Row: {
          data_captura: string
          dedup_incompleta: boolean
          descricao_raw: string | null
          email_recebido_id: string | null
          execucao_id: string | null
          fonte_id: string | null
          hash_semantico: string | null
          hash_url: string | null
          id: string
          payload_normalizado: Json | null
          status: Database["public"]["Enums"]["vaga_bruta_status"]
          titulo_raw: string | null
          url_original: string | null
        }
        Insert: {
          data_captura?: string
          dedup_incompleta?: boolean
          descricao_raw?: string | null
          email_recebido_id?: string | null
          execucao_id?: string | null
          fonte_id?: string | null
          hash_semantico?: string | null
          hash_url?: string | null
          id?: string
          payload_normalizado?: Json | null
          status?: Database["public"]["Enums"]["vaga_bruta_status"]
          titulo_raw?: string | null
          url_original?: string | null
        }
        Update: {
          data_captura?: string
          dedup_incompleta?: boolean
          descricao_raw?: string | null
          email_recebido_id?: string | null
          execucao_id?: string | null
          fonte_id?: string | null
          hash_semantico?: string | null
          hash_url?: string | null
          id?: string
          payload_normalizado?: Json | null
          status?: Database["public"]["Enums"]["vaga_bruta_status"]
          titulo_raw?: string | null
          url_original?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vagas_brutas_email_recebido_id_fkey"
            columns: ["email_recebido_id"]
            isOneToOne: false
            referencedRelation: "emails_recebidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_brutas_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucoes_coleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_brutas_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "fontes_coleta"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vagas_publicas: {
        Row: {
          area_tematica: string | null
          atividades: string | null
          carga_horaria: string | null
          curso_alvo: string[] | null
          data_expiracao_calculada: string | null
          data_publicacao: string | null
          descricao: string | null
          empresa_orgao: string | null
          forma_candidatura: string | null
          id: string | null
          link_candidatura: string | null
          modalidade: Database["public"]["Enums"]["vaga_modalidade"] | null
          municipio: string | null
          natureza_processo:
            | Database["public"]["Enums"]["natureza_processo"]
            | null
          nivel: Database["public"]["Enums"]["vaga_nivel"] | null
          prazo_inscricao: string | null
          regiao: Database["public"]["Enums"]["vaga_regiao"] | null
          remuneracao_bolsa: string | null
          requisitos: string | null
          score_urgencia: number | null
          selo_aderencia: string | null
          selo_parceiro: boolean | null
          sem_prazo_definido: boolean | null
          setor: Database["public"]["Enums"]["vaga_setor"] | null
          subtipo_estagio: Database["public"]["Enums"]["subtipo_estagio"] | null
          tipo: Database["public"]["Enums"]["vaga_tipo"] | null
          titulo: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assinar_newsletter: {
        Args: { p_email: string; p_finalidade?: string; p_termo_versao: string }
        Returns: Json
      }
      bio_calcular_expiracao: {
        Args: { p_prazo: string; p_publicacao: string; p_sem_prazo: boolean }
        Returns: string
      }
      bio_calcular_regiao: {
        Args: { p_municipio: string }
        Returns: Database["public"]["Enums"]["vaga_regiao"]
      }
      bio_cron: {
        Args: { p_cron: string; p_nome: string; p_sql: string }
        Returns: undefined
      }
      bio_duplicatas_fila: {
        Args: never
        Returns: {
          dup_empresa: string
          dup_id: string
          dup_origem: string
          dup_status: string
          dup_titulo: string
          similaridade: number
          vaga_id: string
        }[]
      }
      bio_is_admin: { Args: never; Returns: boolean }
      bio_score_aderencia: {
        Args: { v: Database["public"]["Tables"]["vagas"]["Row"] }
        Returns: number
      }
      bio_score_urgencia: {
        Args: {
          p_exp: string
          p_sem_prazo: boolean
          p_status: Database["public"]["Enums"]["vaga_status"]
        }
        Returns: number
      }
      descadastrar_newsletter: { Args: { p_token: string }; Returns: Json }
      registrar_clique: { Args: { p_vaga_id: string }; Returns: Json }
      registrar_feedback: {
        Args: {
          p_tipo: Database["public"]["Enums"]["feedback_tipo"]
          p_token: string
          p_vaga_id: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      email_status: "processado" | "nao_reconhecido" | "erro" | "reprocessado"
      execucao_status: "sucesso" | "falha_parcial" | "falha_total"
      feedback_tipo:
        | "me_candidatei"
        | "link_invalido"
        | "vaga_encerrada"
        | "vaga_suspeita"
      feedback_validacao: "valido" | "suspeito" | "descartado"
      fonte_canal: "canal_a_http" | "canal_b_email" | "canal_c_assistido"
      fonte_metodo:
        | "rss"
        | "http_parser"
        | "email_alert"
        | "formulario"
        | "manual"
        | "csv"
      fonte_status:
        | "ativa"
        | "pausada"
        | "bloqueada"
        | "em_teste"
        | "quarentena"
      fonte_tipo:
        | "portal_vagas"
        | "orgao_publico"
        | "ong"
        | "rede_social"
        | "diario_oficial"
        | "parceiro"
        | "agregador"
        | "alerta_email"
      motivo_rejeicao:
        | "fora_do_perfil"
        | "fonte_duvidosa"
        | "suspeita_fraude"
        | "duplicata"
        | "prazo_expirado"
        | "incompativel_tecnico"
        | "outros"
      natureza_processo:
        | "concurso_publico"
        | "processo_seletivo_simplificado"
        | "selecao_privada"
        | "edital_bolsa"
        | "nao_aplicavel"
      notificacao_status: "enviado" | "falha_parcial" | "falha_total"
      origem_registro:
        | "autodeclaracao"
        | "suap"
        | "indicacao_docente"
        | "comprovante_tce"
        | "outros"
      parceiro_tipo:
        | "empresa_privada"
        | "orgao_publico"
        | "ong"
        | "consultoria"
        | "laboratorio"
      profile_role: "admin" | "editor" | "colaborador" | "visualizador"
      regiao_bio: "rmf" | "interior_ceara" | "fora_ceara"
      status_link: "ativo" | "inacessivel" | "redirecionado" | "nao_verificado"
      subtipo_estagio:
        | "obrigatorio"
        | "nao_obrigatorio"
        | "extracurricular"
        | "nao_aplicavel"
      tipo_vinculo:
        | "estagio"
        | "emprego_clt"
        | "emprego_pj"
        | "bolsa"
        | "voluntario"
      vaga_bruta_status:
        | "pendente_normalizacao"
        | "normalizada"
        | "descartada_duplicata"
        | "descartada_lista_negra"
        | "descartada_ttl"
        | "erro"
      vaga_modalidade: "presencial" | "remoto" | "hibrido"
      vaga_nivel: "tecnico" | "superior" | "ambos"
      vaga_regiao: "rmf" | "interior_ceara" | "fora_ceara" | "indefinido"
      vaga_setor: "privado" | "publico"
      vaga_status:
        | "pendente"
        | "aprovada"
        | "rejeitada"
        | "expirada"
        | "suspensa"
        | "arquivada"
      vaga_tipo: "estagio" | "emprego" | "processo_seletivo" | "bolsa"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      email_status: ["processado", "nao_reconhecido", "erro", "reprocessado"],
      execucao_status: ["sucesso", "falha_parcial", "falha_total"],
      feedback_tipo: [
        "me_candidatei",
        "link_invalido",
        "vaga_encerrada",
        "vaga_suspeita",
      ],
      feedback_validacao: ["valido", "suspeito", "descartado"],
      fonte_canal: ["canal_a_http", "canal_b_email", "canal_c_assistido"],
      fonte_metodo: [
        "rss",
        "http_parser",
        "email_alert",
        "formulario",
        "manual",
        "csv",
      ],
      fonte_status: ["ativa", "pausada", "bloqueada", "em_teste", "quarentena"],
      fonte_tipo: [
        "portal_vagas",
        "orgao_publico",
        "ong",
        "rede_social",
        "diario_oficial",
        "parceiro",
        "agregador",
        "alerta_email",
      ],
      motivo_rejeicao: [
        "fora_do_perfil",
        "fonte_duvidosa",
        "suspeita_fraude",
        "duplicata",
        "prazo_expirado",
        "incompativel_tecnico",
        "outros",
      ],
      natureza_processo: [
        "concurso_publico",
        "processo_seletivo_simplificado",
        "selecao_privada",
        "edital_bolsa",
        "nao_aplicavel",
      ],
      notificacao_status: ["enviado", "falha_parcial", "falha_total"],
      origem_registro: [
        "autodeclaracao",
        "suap",
        "indicacao_docente",
        "comprovante_tce",
        "outros",
      ],
      parceiro_tipo: [
        "empresa_privada",
        "orgao_publico",
        "ong",
        "consultoria",
        "laboratorio",
      ],
      profile_role: ["admin", "editor", "colaborador", "visualizador"],
      regiao_bio: ["rmf", "interior_ceara", "fora_ceara"],
      status_link: ["ativo", "inacessivel", "redirecionado", "nao_verificado"],
      subtipo_estagio: [
        "obrigatorio",
        "nao_obrigatorio",
        "extracurricular",
        "nao_aplicavel",
      ],
      tipo_vinculo: [
        "estagio",
        "emprego_clt",
        "emprego_pj",
        "bolsa",
        "voluntario",
      ],
      vaga_bruta_status: [
        "pendente_normalizacao",
        "normalizada",
        "descartada_duplicata",
        "descartada_lista_negra",
        "descartada_ttl",
        "erro",
      ],
      vaga_modalidade: ["presencial", "remoto", "hibrido"],
      vaga_nivel: ["tecnico", "superior", "ambos"],
      vaga_regiao: ["rmf", "interior_ceara", "fora_ceara", "indefinido"],
      vaga_setor: ["privado", "publico"],
      vaga_status: [
        "pendente",
        "aprovada",
        "rejeitada",
        "expirada",
        "suspensa",
        "arquivada",
      ],
      vaga_tipo: ["estagio", "emprego", "processo_seletivo", "bolsa"],
    },
  },
} as const
