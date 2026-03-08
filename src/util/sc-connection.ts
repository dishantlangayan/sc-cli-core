import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios'

export type HttpAuthType = 'basic' | 'bearer'
export type ApiType = 'cloud' | 'semp'

export interface ScConnectionOptions {
  apiType?: ApiType
  apiVersion?: string
  authType?: HttpAuthType
  timeout?: number
}

export class ScConnection {
  private axiosInstance: AxiosInstance
  private endpointUrl: string = ''

  constructor(baseURL: string, accessToken: string, options?: ScConnectionOptions) {
    // Validate required parameters
    if (!baseURL || baseURL.trim() === '') {
      throw new Error('baseURL is required and cannot be empty')
    }

    if (!accessToken || accessToken.trim() === '') {
      throw new Error('accessToken is required and cannot be empty')
    }

    // Extract options with defaults
    const {apiType = 'cloud', apiVersion = 'v2', authType = 'bearer', timeout = 10_000} = options ?? {}

    // Build endpoint URL based on apiType
    // For SEMP: use baseURL directly (version specified in actual API calls)
    // For cloud: append /api/{version}
    const apiPath = apiType === 'semp' ? '' : `/api/${apiVersion}`
    this.endpointUrl = apiPath ? this.joinPaths(baseURL, apiPath) : baseURL

    // Build authorization header based on authType
    const authHeader = authType === 'basic' ? `Basic ${accessToken}` : `Bearer ${accessToken}`

    this.axiosInstance = axios.create({
      baseURL: this.endpointUrl,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      timeout,
    })

    // Add interceptors
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message)
        return Promise.reject(error)
      },
    )
  }

  // DELETE request
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.delete(url, config)
    return response.data
  }

  // GET request
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.get(url, config)
    return response.data
  }

  // PATCH request
  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.patch(url, data, config)
    return response.data
  }

  // POST request
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.post(url, data, config)
    return response.data
  }

  // PUT request
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.put(url, data, config)
    return response.data
  }

  private joinPaths(base: string, path: string): string {
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  }
}

export default ScConnection
